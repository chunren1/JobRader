/**
 * JobRadar Content Script
 * 在招聘网站页面注入，负责提取岗位数据
 */

const NEXTJS_URL = "http://localhost:3000";
const LOCAL_SECRET = "job-radar-local-dev-secret-change-me";

// 清理文本中的乱码和控制字符
function cleanText(s) {
  if (!s) return "";
  return s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uE000-\uF8FF\uFFF0-\uFFFF]/g, "")
    .replace(/\s+/g, " ").trim();
}

// 清理标题，去掉末尾可能混入的薪资数字（如 "xxx 15-25K"）
function cleanTitle(title) {
  var t = cleanText(title);
  // 如果末尾有类似 "20-35K" 的薪资数字，去掉
  t = t.replace(/\s*\d+[-~]\d+[kK].*$/, "");
  return t || title;
}

// ============================================
// 薪资解析 - 多种策略
// ============================================
function parseSalary(rawText) {
  var text = cleanText(rawText);
  if (!text) return { min: null, max: null, raw: text };

  // 去掉 "·16薪" 等后缀
  text = text.replace(/·.*$/, "").trim();

  // 策略1: 标准范围 "20K-35K", "15k-25k", "2万-3万"
  var m = text.match(/(\d+\.?\d*)\s*[kK万萬]?\s*[-~至到]\s*(\d+\.?\d*)\s*[kK万萬]/);
  if (m) {
    return numberRange(m[1], m[2], text);
  }

  // 策略2: 纯数字范围 "20000-35000", "15000-25000"
  m = text.match(/(\d{4,6})\s*[-~至到]\s*(\d{4,6})/);
  if (m) {
    var mn = parseInt(m[1]), mx = parseInt(m[2]);
    if (mn > 100 && mx > 100) return { min: mn, max: mx, raw: text };
  }

  // 策略3: 单个数值 "30K起" / "最高50K"
  m = text.match(/(\d+\.?\d*)\s*[kK万萬]/);
  if (m) {
    var val = parseFloat(m[1]);
    if (text.includes("万") || text.includes("萬")) val *= 10000;
    else val *= 1000;
    return text.includes("最高") || text.includes("max")
      ? { min: null, max: Math.round(val), raw: text }
      : { min: Math.round(val), max: null, raw: text };
  }

  // 全部失败，返回原始文本供调试
  return { min: null, max: null, raw: text };
}

function numberRange(s1, s2, text) {
  var min = parseFloat(s1), max = parseFloat(s2);
  if (text.includes("万") || text.includes("萬")) {
    min *= 10000; max *= 10000;
  } else if (text.includes("K") || text.includes("k")) {
    min *= 1000; max *= 1000;
  } else if (min < 100 && max < 500) {
    min *= 1000; max *= 1000;
  }
  return { min: Math.round(min), max: Math.round(max), raw: text };
}

// ============================================
// 岗位提取
// ============================================
function extractJobs() {
  var jobs = [];
  var seen = {};

  // 策略: 找到所有包含链接的卡片型元素
  var allLinks = document.querySelectorAll("a[href]");
  allLinks.forEach(function(link) {
    var href = link.href || link.getAttribute("href") || "";
    if (!href || !href.includes("job_detail")) return;
    if (seen[href]) return;
    seen[href] = true;

    // 找到父级卡片
    var card = link.closest("li") || link.closest("[class*='card']") || 
               link.closest("[class*='item']") || link.closest("div");

    if (!card) return;

    var text = cleanText(card.innerText || card.textContent);
    if (text.length < 20) return;

    // 解析卡片文本提取各字段
    var parsed = parseCardText(text);
    if (!parsed.title || !parsed.company) return;

    // 提取标签
    var tags = [];
    card.querySelectorAll("[class*='tag'], [class*='skill']").forEach(function(el) {
      var t = cleanText(el.innerText || el.textContent);
      if (t && t.length < 20 && tags.indexOf(t) === -1) tags.push(t);
    });

    // 提取 JD 描述
    var jdEl = card.querySelector("[class*='desc'], [class*='info'], [class*='detail']");
    var jd = jdEl ? cleanText(jdEl.innerText || jdEl.textContent) : "";

    // 薪资优先从独立元素提取
    var salEl = card.querySelector("[class*='salary'], [class*='pay'], .red");
    var salText = salEl ? cleanText(salEl.innerText || salEl.textContent) : parsed.salaryText || "";
    var salary = parseSalary(salText);

    // 地点
    var locEl = card.querySelector("[class*='area'], [class*='location'], [class*='addr']");
    var location = locEl ? cleanText(locEl.innerText || locEl.textContent) : parsed.location || "未知";

    var rawUrl = href.startsWith("http") ? href : "https://www.zhipin.com" + href;

    // 标题中可能混了薪资数字，清理
    var title = cleanTitle(parsed.title);

    jobs.push({
      title: title,
      company: parsed.company,
      salaryMin: salary.min,
      salaryMax: salary.max,
      location: location,
      jdContent: jd || text.substring(0, 500),
      tags: tags,
      rawUrl: rawUrl,
      source: "platform"
    });
  });

  console.log("[JobRadar] Extracted " + jobs.length + " jobs from " + allLinks.length + " links");
  return jobs;
}

// 从卡片文本智能解析字段
function parseCardText(fullText) {
  var lines = fullText.split(/\n|  +/).filter(function(l) { return l.trim().length > 0; });
  var result = { title: "", company: "", salaryText: "", location: "" };

  // 尝试从每行匹配
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    
    // 薪资行: 包含 K/k/万/薪 或纯数字范围
    if (/[0-9][kK万萬]|[0-9]{4,}-[0-9]{4,}/.test(line) && line.length < 30) {
      result.salaryText = result.salaryText || line;
    }
    // 地点行: 常见城市名
    else if (/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州|东莞|合肥|佛山|福州/.test(line) && line.length < 10) {
      result.location = result.location || line;
    }
    // 公司名通常在第二或第三行
    else if (!result.company && i > 2 && i < 8 && line.length < 30) {
      result.company = line;
    }
    
    // 标题通常是第一较长行
    if (!result.title && line.length > 5) {
      result.title = line;
    }
  }

  // 如果没找到公司，用第二行
  if (!result.company && lines.length > 1) {
    result.company = lines[1];
  }

  // 如果标题里包含了薪资，去掉
  if (result.salaryText && result.title.indexOf(result.salaryText) !== -1) {
    result.title = result.title.replace(result.salaryText, "").trim();
  }

  return result;
}

// ============================================
// 同步到 Next.js
// ============================================
async function syncJobs(jobs) {
  for (var attempt = 1; attempt <= 3; attempt++) {
    try {
      var res = await fetch(NEXTJS_URL + "/api/jobs/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Local-Secret": LOCAL_SECRET,
        },
        body: JSON.stringify({ jobs: jobs }),
      });
      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        if (res.status === 401) return { success: false, error: "认证失败" };
        console.warn("[JobRadar] Sync attempt " + attempt + " failed:", err.error);
        if (attempt < 3) await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
        continue;
      }
      var data = await res.json();
      return { success: true, count: data.total, ingested: data.ingested, updated: data.updated };
    } catch (e) {
      console.warn("[JobRadar] Sync attempt " + attempt + " error:", e.message);
      if (attempt < 3) await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
    }
  }
  return { success: false, error: "所有重试均失败" };
}

// ============================================
// 消息处理
// ============================================
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === "EXTRACT_AND_SYNC") {
    (async function () {
      try {
        var jobs = extractJobs();
        console.log("[JobRadar] Extracted " + jobs.length + " jobs");

        if (jobs.length === 0) {
          sendResponse({ success: false, error: "未检测到职位，请确认在职位列表页" });
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
    var cards = document.querySelectorAll("a[href*='job_detail']");
    sendResponse({
      success: true,
      isListPage: cards.length >= 3,
      isDetailPage: window.location.href.indexOf("job_detail") !== -1,
      title: document.title,
      url: window.location.href,
    });
    return true;
  }
});
