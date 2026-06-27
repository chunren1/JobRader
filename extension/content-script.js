/**
 * JobRadar Content Script v3
 * 适配 Boss 直聘列表页结构
 */
var NEXTJS_URL = "http://localhost:3000";
var LOCAL_SECRET = "job-radar-local-dev-secret-change-me";

function cleanText(s) {
  if (!s) return "";
  return s.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uE000-\uF8FF\uFFF0-\uFFFF]/g, "").replace(/\s+/g, " ").trim();
}

// ============================================
// 薪资解析
// ============================================
function parseSalary(rawText) {
  var text = cleanText(rawText);
  if (!text) return { min: null, max: null };

  // 匹配 "20-35K", "150-250元/天", "2万-3万"
  var m = text.match(/(\d+\.?\d*)\s*[-~至到]\s*(\d+\.?\d*)\s*(元\/天|[kK万萬])/);
  if (m) {
    var min = parseFloat(m[1]), max = parseFloat(m[2]), unit = m[3] || "";
    if (unit === "万" || unit === "萬") { min *= 10000; max *= 10000; }
    else if (unit === "K" || unit === "k") { min *= 1000; max *= 1000; }
    else if (unit === "元/天") { min *= 22; max *= 22; } // 日薪×22=月薪估算
    else if (min < 100 && max < 500) { min *= 1000; max *= 1000; }
    return { min: Math.round(min), max: Math.round(max) };
  }

  // 纯数字范围 "20000-35000"
  m = text.match(/(\d{4,6})\s*[-~至到]\s*(\d{4,6})/);
  if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };

  // 单数值 "30K"
  m = text.match(/(\d+\.?\d*)\s*([kK万萬])/);
  if (m) {
    var val = parseFloat(m[1]);
    if (m[2] === "万" || m[2] === "萬") val *= 10000; else val *= 1000;
    return (text.match(/最高|max/)) ? { min: null, max: Math.round(val) } : { min: Math.round(val), max: null };
  }

  return { min: null, max: null };
}

// ============================================
// 主入口：区分页面类型
// ============================================
function extractJobs() {
  var url = window.location.href;
  // 详情页：URL 包含 job_detail
  if (url.indexOf("job_detail") !== -1) {
    var job = extractFromDetailPage();
    return job ? [job] : [];
  }
  // 列表页
  return extractFromListPage();
}

// ============================================
// 详情页提取
// ============================================
function extractFromDetailPage() {
  // 标题：找页面主标题
  var title = "";
  var titleSelectors = ["h1", "h1.name", ".name h1", ".job-title", "[class*='job-name']", ".info-primary h1", ".info-primary .name"];
  for (var i = 0; i < titleSelectors.length; i++) {
    var el = document.querySelector(titleSelectors[i]);
    if (el) {
      var t = cleanText(el.innerText || el.textContent);
      if (t && t.length > 2 && t.length < 80) {
        // 标题元素经常包含薪资，分离出来
        var salMatch = t.match(/\d+[-~]\d+[kK元]/);
        if (salMatch) {
          t = t.replace(salMatch[0], "").trim();
        }
        title = t;
        break;
      }
    }
  }
  if (!title) {
    var docTitle = cleanText(document.title);
    if (docTitle.length > 2 && docTitle.length < 60) title = docTitle.split(/[-_|]/)[0].trim();
  }
  if (!title) return null;

  // 公司
  var companyEl = document.querySelector("[class*='company-info'] [class*='name'], .company-info .name, .company-name, [class*='cname']");
  var company = companyEl ? cleanText(companyEl.innerText || companyEl.textContent) : "未知";

  // 薪资
  var salEl = document.querySelector(".salary, .info-primary .salary, [class*='salary'], .red");
  var salText = salEl ? cleanText(salEl.innerText || salEl.textContent) : "";
  var salary = parseSalary(salText);

  // 地点
  var locEl = document.querySelector(".info-primary p, [class*='area'], [class*='location']");
  var location = "未知";
  if (locEl) {
    var locText = cleanText(locEl.innerText || locEl.textContent);
    var cityMatch = locText.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州|东莞|合肥|佛山|福州|青岛|大连/);
    if (cityMatch) location = cityMatch[0];
  }

  // JD 描述
  var jdEl = document.querySelector(".job-detail, .job-sec-text, .text, [class*='job-detail'], [class*='detail-content'], [class*='job-sec']");
  var jd = jdEl ? cleanText(jdEl.innerText || jdEl.textContent) : "";
  if (!jd || jd.length < 30) {
    jd = cleanText(document.body.innerText).substring(0, 2000);
  }

  // 标签
  var tags = [];
  document.querySelectorAll(".job-tags .tag-item, .job-detail-tags li, [class*='tag-item'], [class*='skill-tag']").forEach(function(el) {
    var t = cleanText(el.innerText || el.textContent);
    if (t && t.length < 15 && tags.indexOf(t) === -1) tags.push(t);
  });

  return {
    title: title, company: company,
    salaryMin: salary.min, salaryMax: salary.max,
    location: location, jdContent: jd,
    tags: tags, rawUrl: window.location.href, source: "platform"
  };
}

// ============================================
// 列表页提取 - 解析每个卡片
// ============================================
function extractFromListPage() {
  var jobs = [];
  var seen = {};

  // Boss列表页卡片选择器（多种尝试）
  var cardSelectors = [
    ".job-card-wrapper",
    ".job-card-box",
    ".search-job-result li",
    ".job-list li",
    "ul.job-list > li",
    "[class*='job-card']"
  ];

  var cards = null;
  for (var i = 0; i < cardSelectors.length; i++) {
    cards = document.querySelectorAll(cardSelectors[i]);
    if (cards.length >= 3) {
      console.log("[JobRadar] Using selector:", cardSelectors[i], "found:", cards.length);
      break;
    }
  }

  // 兜底：所有 li
  if (!cards || cards.length < 3) {
    cards = document.querySelectorAll("li");
    console.log("[JobRadar] Fallback to li, found:", cards.length);
  }

  cards.forEach(function(card) {
    try {
      // 必须包含岗位链接
      var link = card.querySelector("a[href*='job_detail'], a[href*='job/'], .job-card-left, .job-name a");
      if (!link) link = card.querySelector("a[href]");
      var href = link ? (link.href || link.getAttribute("href") || "") : "";
      if (!href || href === "#" || href.startsWith("javascript") || href.length < 15) return;
      if (seen[href]) return;
      seen[href] = true;

      // 标题：卡片内的岗位名元素
      var title = "";
      var titleSelectors = [".job-name", ".job-title", "[class*='job-name']", ".name a", ".job-card-left .job-name"];
      for (var i = 0; i < titleSelectors.length; i++) {
        var el = card.querySelector(titleSelectors[i]);
        if (el) {
          var t = cleanText(el.innerText || el.textContent);
          if (t && t.length > 2 && t.length < 80) {
            title = t;
            break;
          }
        }
      }

      // 兜底：从链接文本取
      if (!title && link) {
        var lt = cleanText(link.innerText || link.textContent);
        if (lt.length > 2 && lt.length < 80) title = lt;
      }

      if (!title) return;

      // 公司
      var companyEl = card.querySelector(".company-name, .company-text, [class*='company-name'], .cname, .company-info");
      var company = companyEl ? cleanText(companyEl.innerText || companyEl.textContent) : "未知";

      // 薪资
      var salEl = card.querySelector(".salary, .red, [class*='salary'], [class*='pay']");
      var salText = salEl ? cleanText(salEl.innerText || salEl.textContent) : "";
      var salary = parseSalary(salText);

      // 地点
      var locEl = card.querySelector(".job-area, .area, [class*='area']");
      var location = "未知";
      if (locEl) {
        var locText = cleanText(locEl.innerText || locEl.textContent);
        var cm = locText.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州|东莞|合肥|佛山|福州|青岛|大连/);
        if (cm) location = cm[0];
      }

      // 标签
      var tags = [];
      card.querySelectorAll(".tag-item, .item-tag, [class*='tag']").forEach(function(el) {
        var t = cleanText(el.innerText || el.textContent);
        if (t && t.length < 15 && tags.indexOf(t) === -1) tags.push(t);
      });

      // JD：列表页通常只有简短信息，用卡片完整文本
      var jd = cleanText(card.innerText || card.textContent).substring(0, 500);

      var rawUrl = href.startsWith("http") ? href : "https://www.zhipin.com" + (href.startsWith("/") ? "" : "/") + href;

      jobs.push({
        title: title,
        company: company,
        salaryMin: salary.min,
        salaryMax: salary.max,
        location: location,
        jdContent: jd,
        tags: tags,
        rawUrl: rawUrl,
        source: "platform"
      });
    } catch (e) {
      console.warn("[JobRadar] Card parse error:", e.message);
    }
  });

  console.log("[JobRadar] Extracted " + jobs.length + " jobs from list page");
  return jobs;
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
// 消息处理
// ============================================
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === "EXTRACT_AND_SYNC") {
    (async function () {
      try {
        var jobs = extractJobs();
        console.log("[JobRadar] Extracted " + jobs.length + " jobs");

        if (jobs.length > 0) {
          console.log("[JobRadar] Sample:", { title: jobs[0].title, company: jobs[0].company, sal: jobs[0].salaryMin + "-" + jobs[0].salaryMax, loc: jobs[0].location });
        }

        if (jobs.length === 0) {
          sendResponse({ success: false, error: "未找到岗位卡片，请在职位列表页使用" });
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
