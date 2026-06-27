/**
 * JobRadar Content Script
 * 在招聘网站页面注入，负责提取岗位数据
 */
var NEXTJS_URL = "http://localhost:3000";
var LOCAL_SECRET = "job-radar-local-dev-secret-change-me";

function cleanText(s) {
  if (!s) return "";
  return s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uE000-\uF8FF\uFFF0-\uFFFF]/g, "").replace(/\s+/g, " ").trim();
}

function cleanTitle(title) {
  var t = cleanText(title);
  t = t.replace(/\s*\d+[-~]\d+[kK].*$/, "");
  return t || title;
}

// ============================================
// 薪资解析
// ============================================
function parseSalary(rawText) {
  var text = cleanText(rawText);
  if (!text) return { min: null, max: null };

  text = text.replace(/·.*$/, "").trim();

  var m = text.match(/(\d+\.?\d*)\s*[kK万萬]?\s*[-~至到]\s*(\d+\.?\d*)\s*[kK万萬]/);
  if (m) {
    var min = parseFloat(m[1]), max = parseFloat(m[2]);
    if (text.match(/万|萬/)) { min *= 10000; max *= 10000; }
    else if (text.match(/[kK]/)) { min *= 1000; max *= 1000; }
    else if (min < 100 && max < 500) { min *= 1000; max *= 1000; }
    return { min: Math.round(min), max: Math.round(max) };
  }

  m = text.match(/(\d{4,6})\s*[-~至到]\s*(\d{4,6})/);
  if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };

  m = text.match(/(\d+\.?\d*)\s*[kK万萬]/);
  if (m) {
    var val = parseFloat(m[1]);
    if (text.match(/万|萬/)) val *= 10000; else val *= 1000;
    return (text.match(/最高|max/)) ? { min: null, max: Math.round(val) } : { min: Math.round(val), max: null };
  }

  return { min: null, max: null };
}

// ============================================
// 岗位提取 - 宽松版
// ============================================
function extractJobs() {
  var jobs = [];
  var seen = {};

  // 找所有可能包含岗位描述的容器
  var containers = [];
  var cards = document.querySelectorAll("li, [class*='job'], [class*='card'], [class*='item'], [class*='list'] > *");
  cards.forEach(function(c) {
    var txt = (c.innerText || c.textContent || "").trim();
    // 至少20个字符的文本，且包含薪资或城市特征
    if (txt.length > 20 && (txt.match(/\d+[kK]/) || txt.match(/北京|上海|广州|深圳|杭州/))) {
      containers.push(c);
    }
  });

  containers.forEach(function(card) {
    var text = cleanText(card.innerText || card.textContent);
    if (text.length < 20) return;

    // 提取链接
    var link = card.querySelector("a[href]");
    var href = link ? (link.href || link.getAttribute("href") || "") : "";
    if (!href || href === "#" || href.startsWith("javascript")) {
      // 尝试找子元素中的链接
      var links = card.querySelectorAll("a[href]");
      for (var i = 0; i < links.length; i++) {
        var h = links[i].href || links[i].getAttribute("href") || "";
        if (h && h !== "#" && h.length > 20) { href = h; break; }
      }
    }
    if (!href || href.length < 20) return;
    if (seen[href]) return;
    seen[href] = true;

    // 用正则从文本中提取字段
    var result = parseFromText(text);
    if (!result.title) return;

    // 如果没有公司，尝试独立提取
    if (!result.company) {
      var lines = text.split(/[\n\r]+/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 1 && l.length < 40; });
      if (lines.length > 1) result.company = lines[1];
    }

    var salary = parseSalary(result.saltRaw || "");

    var rawUrl = href.startsWith("http") ? href : "https://www.zhipin.com" + (href.startsWith("/") ? "" : "/") + href;

    jobs.push({
      title: cleanTitle(result.title),
      company: result.company || "未知",
      salaryMin: salary.min,
      salaryMax: salary.max,
      location: result.location || "未知",
      jdContent: text.substring(0, 500),
      tags: [],
      rawUrl: rawUrl,
      source: "platform"
    });
  });

  return jobs;
}

// 从文本块提取字段
function parseFromText(text) {
  var result = { title: "", location: "", saltRaw: "" };
  var lines = text.split(/[\n\r]+/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 1; });

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // 薪资行
    if (!result.saltRaw && line.match(/\d+[kK万萬]/) && line.length < 30) {
      result.saltRaw = line;
    }
    // 城市行
    else if (!result.location && line.match(/^(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州|东莞|合肥|佛山|福州|青岛|大连)$/)) {
      result.location = line;
    }
    // 标题 - 第一个较长且不含薪资的行
    else if (!result.title && line.length > 3) {
      // 跳过学历经验行
      if (line.match(/^(本科|大专|硕士|博士|经验|在校|应届|不限)/)) continue;
      result.title = line;
    }
  }

  // 如果标题中有薪资，去掉
  if (result.saltRaw && result.title.indexOf(result.saltRaw) !== -1) {
    result.title = result.title.replace(result.saltRaw, "").trim();
  }

  // 如果还找不到城市，整段搜索
  if (!result.location) {
    var m = text.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门/);
    if (m) result.location = m[0];
  }

  return result;
}

// ============================================
// 同步
// ============================================
async function syncJobs(jobs) {
  for (var attempt = 1; attempt <= 3; attempt++) {
    try {
      var res = await fetch(NEXTJS_URL + "/api/jobs/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Local-Secret": LOCAL_SECRET },
        body: JSON.stringify({ jobs: jobs }),
      });
      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        if (res.status === 401) return { success: false, error: "认证失败" };
        if (attempt < 3) await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
        continue;
      }
      var data = await res.json();
      return { success: true, count: data.total, ingested: data.ingested, updated: data.updated };
    } catch (e) {
      if (attempt < 3) await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
    }
  }
  return { success: false, error: "同步失败" };
}

// ============================================
// 消息
// ============================================
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === "EXTRACT_AND_SYNC") {
    (async function () {
      try {
        var containers = document.querySelectorAll("li, [class*='job'], [class*='card'], [class*='item'], [class*='list'] > *");
        console.log("[JobRadar] Scanning " + containers.length + " containers...");

        var jobs = extractJobs();
        console.log("[JobRadar] Extracted " + jobs.length + " jobs");

        // 输出首个成功项
        if (jobs.length > 0) {
          console.log("[JobRadar] Sample:", { title: jobs[0].title.substring(0,40), company: jobs[0].company, location: jobs[0].location, sal: jobs[0].salaryMin + "-" + jobs[0].salaryMax });
        } else {
          // 输出样本容器文本
          var samples = [];
          containers.forEach(function(c) {
            if (samples.length >= 3) return;
            var t = (c.innerText || c.textContent || "").trim();
            if (t.length > 30) samples.push(t.substring(0, 150));
          });
          console.log("[JobRadar] Sample texts:", samples);
        }

        if (jobs.length === 0) {
          sendResponse({ success: false, error: "未找到岗位（扫描" + containers.length + "个容器）" });
          return;
        }

        var result = await syncJobs(jobs);
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "CHECK_PAGE") {
    var links = document.querySelectorAll("a[href]");
    var count = 0;
    links.forEach(function(l) {
      var h = l.href || l.getAttribute("href") || "";
      if (h && h !== "#" && !h.startsWith("javascript") && h.length > 20) count++;
    });
    sendResponse({ success: true, isListPage: count >= 3, linkCount: count, title: document.title, url: window.location.href });
    return true;
  }
});
