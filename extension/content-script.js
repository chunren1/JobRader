/**
 * JobRadar Content Script v4
 * 诊断修复：薪资反爬字体 + JD/要求提取
 */
var NEXTJS_URL = "http://localhost:3000";
var LOCAL_SECRET = "job-radar-local-dev-secret-change-me";

// ============================================
// 反爬薪资解码 — XHR 拦截 + 字体解码
// ============================================
var salaryCache = {}; // { url/selector: {min, max} }

// 方法1: 拦截 fetch/XHR 响应，从 JSON 中提取真实薪资
(function() {
  var origFetch = window.fetch;
  window.fetch = function() {
    return origFetch.apply(this, arguments).then(function(resp) {
      var url = arguments[0];
      if (typeof url === "string" && url.indexOf("zhipin") > -1 && url.indexOf("search") > -1) {
        resp.clone().json().then(function(json) {
          try {
            var list = json.zpData || json.data || {};
            var jobs = list.jobList || list.jobCards || [];
            if (Array.isArray(jobs)) {
              jobs.forEach(function(j) {
                if (j.encryptJobId || j.securityId || j.jobId) {
                  var key = j.encryptJobId || j.securityId || j.jobId;
                  salaryCache[key] = { min: j.minSalary || j.salaryMin, max: j.maxSalary || j.salaryMax };
                }
              });
              console.log("[JobRadar] Captured salary for " + Object.keys(salaryCache).length + " jobs from API");
            }
          } catch(e) { /* JSON parse error */ }
        }).catch(function(){});
      }
      return resp;
    }).catch(function(){ return origFetch.apply(this, arguments); });
  };
})();

// 方法2: 字体解码 — 查找 Boss 自定义字体，尝试映射字符→数字
function decodeSalaryFont(rawText) {
  if (!rawText) return rawText;
  // 检查是否含私有区字符（Boss 反爬字体的特征）
  var hasPrivate = /[\uE000-\uF8FF]/.test(rawText);
  if (!hasPrivate) return rawText;

  // 尝试从页面 CSS 找字体映射
  try {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules || sheets[i].rules;
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var text = rules[j].cssText || "";
          if (text.indexOf("font-face") > -1 && text.indexOf("boss") > -1) {
            console.log("[JobRadar] Found Boss font-face:", text.substring(0, 200));
          }
        }
      } catch(e) {}
    }
  } catch(e) {}

  // 解码规则：Boss字体中常见映射
  // 注意：不同版本的 Boss 字体映射不同，这是尝试性解码
  var map = {};
  // 尝试：从 CSS 类名推断 — 常见映射 =0, =1 ...
  for (var k = 0; k < 10; k++) {
    map[String.fromCharCode(0xE000 + k)] = String(k);
  }
  // 也尝试常见的偏移
  for (var k = 0; k < 10; k++) {
    map[String.fromCharCode(0xE050 + k)] = String(k);
    map[String.fromCharCode(0xE060 + k)] = String(k);
    map[String.fromCharCode(0xE070 + k)] = String(k);
  }

  // 递归替换
  var result = rawText;
  var changed = true;
  while (changed) {
    changed = false;
    for (var char in map) {
      if (result.indexOf(char) !== -1) {
        result = result.split(char).join(map[char]);
        changed = true;
      }
    }
  }

  return result;
}

// ============================================
// 文本清理
// ============================================
function cleanText(s) {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

// ============================================
// 薪资解析 — 增强版
// ============================================
function parseSalary(rawText) {
  // 先尝试字体解码
  var text = decodeSalaryFont(rawText);
  if (!text) return { min: null, max: null };

  // 策略1: 匹配 "20-35K", "150-250元/天", "2万-3万"
  var m = text.match(/(\d+\.?\d*)\s*[-~至到]\s*(\d+\.?\d*)\s*(元\/天|[kK]|万|萬)/);
  if (m) {
    var min = parseFloat(m[1]), max = parseFloat(m[2]), unit = m[3] || "";
    if (unit === "万" || unit === "萬") { min *= 10000; max *= 10000; }
    else if (unit === "K" || unit === "k") { min *= 1000; max *= 1000; }
    else if (unit === "元/天") { min *= 22; max *= 22; }
    else if (min < 100 && max < 500) { min *= 1000; max *= 1000; }
    return { min: Math.round(min), max: Math.round(max) };
  }

  // 策略2: 纯数字范围 "20000-35000"
  m = text.match(/(\d{4,6})\s*[-~至到]\s*(\d{4,6})/);
  if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };

  // 策略3: 从API缓存查找
  return { min: null, max: null };
}

// 从缓存找薪资
function getSalaryFromCache(cardText, href) {
  // 从 href 中提取 key
  if (href) {
    var keyMatch = href.match(/[?&](securityId|encryptJobId)=([^&]+)/);
    if (keyMatch) {
      var cached = salaryCache[keyMatch[2]];
      if (cached) return { min: cached.min, max: cached.max };
    }
  }
  // 遍历缓存找匹配
  for (var key in salaryCache) {
    if (salaryCache[key]) return salaryCache[key];
  }
  return null;
}

// ============================================
// 主入口
// ============================================
function extractJobs() {
  var url = window.location.href;
  if (url.indexOf("job_detail") !== -1) {
    var job = extractFromDetailPage();
    return job ? [job] : [];
  }
  return extractFromListPage();
}

// ============================================
// 详情页提取
// ============================================
function extractFromDetailPage() {
  var title = "";
  var titleSels = ["h1", ".name h1", ".job-title", "[class*='job-name']", ".info-primary .name"];
  for (var i = 0; i < titleSels.length; i++) {
    var el = document.querySelector(titleSels[i]);
    if (el) {
      var t = cleanText(el.innerText || el.textContent);
      if (t && t.length > 2 && t.length < 80) {
        title = t.replace(/\s*\d+[-~]\d+[kK元].*$/, "").trim();
        break;
      }
    }
  }
  if (!title) { var dt = cleanText(document.title); title = dt.split(/[-_|]/)[0].trim(); }
  if (!title) return null;

  var companyEl = document.querySelector("[class*='company-info'] [class*='name'], .company-name, [class*='cname']");
  var company = companyEl ? cleanText(companyEl.innerText || companyEl.textContent) : "未知";

  // 薪资：先字体解码，再API缓存，再文本解析
  var salEl = document.querySelector(".salary, [class*='salary'], .red");
  var salary = getSalaryFromCache("", window.location.href);
  if (!salary && salEl) {
    salary = parseSalary(salEl.innerText || salEl.textContent);
  }

  var locEl = document.querySelector("[class*='area'], [class*='location'], .info-primary p");
  var location = "未知";
  if (locEl) {
    var cm = (locEl.innerText || locEl.textContent).match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州/);
    if (cm) location = cm[0];
  }

  // JD + 要求 — 详情页完整提取
  var jdEl = document.querySelector(".job-detail, .job-sec-text, [class*='job-detail'], [class*='detail-content'], [class*='job-sec']");
  var jd = jdEl ? cleanText(jdEl.innerText || jdEl.textContent) : "";
  if (!jd || jd.length < 50) {
    // 从 body 中提取最长的文本块作为 JD
    var divs = document.querySelectorAll("div");
    var longest = "";
    divs.forEach(function(d) {
      var t = cleanText(d.innerText || d.textContent);
      if (t.length > longest.length && t.length < 5000 && (t.indexOf("岗位") > -1 || t.indexOf("职责") > -1 || t.indexOf("要求") > -1)) longest = t;
    });
    jd = longest || cleanText(document.body.innerText).substring(0, 2000);
  }

  var tags = [];
  document.querySelectorAll("[class*='tag-item'], [class*='skill-tag'], .job-tags li").forEach(function(el) {
    var t = cleanText(el.innerText || el.textContent);
    if (t && t.length < 15 && tags.indexOf(t) === -1) tags.push(t);
  });

  return {
    title: title, company: company,
    salaryMin: salary ? salary.min : null, salaryMax: salary ? salary.max : null,
    location: location, jdContent: jd,
    tags: tags, rawUrl: window.location.href, source: "platform"
  };
}

// ============================================
// 列表页提取
// ============================================
function extractFromListPage() {
  var jobs = [];
  var seen = {};

  var cardSels = [".job-card-wrapper", ".job-card-box", "[class*='job-card']", ".search-job-result li", "ul.job-list > li"];
  var cards;
  for (var i = 0; i < cardSels.length; i++) {
    cards = document.querySelectorAll(cardSels[i]);
    if (cards.length >= 3) break;
  }
  if (!cards || cards.length < 3) cards = document.querySelectorAll("li");

  cards.forEach(function(card) {
    try {
      var link = card.querySelector("a[href*='job_detail'], a[href*='job/'], .job-name a, .job-card-left a");
      if (!link) link = card.querySelector("a[href]");
      var href = link ? (link.href || link.getAttribute("href") || "") : "";
      if (!href || href === "#" || href.startsWith("javascript") || href.length < 15) return;
      if (seen[href]) return;
      seen[href] = true;

      var title = "";
      var tSels = [".job-name", ".job-title", "[class*='job-name']", ".name a"];
      for (var i = 0; i < tSels.length; i++) {
        var el = card.querySelector(tSels[i]);
        if (el) { var t = cleanText(el.innerText || el.textContent); if (t && t.length > 2 && t.length < 80) { title = t; break; } }
      }
      if (!title) return;

      var fullText = cleanText(card.innerText || card.textContent);

      // 薪资：AI缓存优先 → 字体解码 → 文本解析
      var salary = getSalaryFromCache(fullText, href);
      if (!salary || salary.min == null) {
        var salEl = card.querySelector(".salary, .red, [class*='salary'], [class*='pay']");
        var salText = salEl ? (salEl.innerText || salEl.textContent) : "";
        salary = parseSalary(salText);
      }

      // 公司+地点
      var company = "未知", location = "未知";
      var companyEl = card.querySelector(".company-name, .company-text, [class*='company-name'], .cname");
      if (companyEl) company = cleanText(companyEl.innerText || companyEl.textContent);

      var locEl = card.querySelector(".job-area, .area, [class*='area']");
      if (locEl) {
        var cm = (locEl.innerText || locEl.textContent).match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州/);
        if (cm) location = cm[0];
      }
      if (location === "未知") {
        var cm2 = fullText.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门/);
        if (cm2) location = cm2[0];
      }

      // 从卡片提取 JD 摘要（保留原始文本含反爬字符用于AI分析）
      var jdText = card.innerText || card.textContent;
      var jd = jdText.length > 500 ? jdText.substring(0, 500) : jdText;

      var tags = [];
      card.querySelectorAll(".tag-item, .item-tag, [class*='tag']").forEach(function(el) {
        var t = cleanText(el.innerText || el.textContent);
        if (t && t.length < 15 && tags.indexOf(t) === -1) tags.push(t);
      });

      var rawUrl = href.startsWith("http") ? href : "https://www.zhipin.com" + (href.startsWith("/") ? "" : "/") + href;

      jobs.push({
        title: title, company: company,
        salaryMin: salary ? salary.min : null, salaryMax: salary ? salary.max : null,
        location: location, jdContent: jd,
        tags: tags, rawUrl: rawUrl, source: "platform"
      });
    } catch (e) {}
  });

  console.log("[JobRadar] List page: " + jobs.length + " jobs, API cache: " + Object.keys(salaryCache).length + " salaries");
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
        var jobs = extractJobs();
        console.log("[JobRadar] Total: " + jobs.length + " jobs, salaryCache: " + Object.keys(salaryCache).length);

        if (jobs.length > 0) {
          var s = jobs[0];
          console.log("[JobRadar] Sample:", { title: s.title, company: s.company, sal: s.salaryMin + "-" + s.salaryMax, loc: s.location });
        }

        if (jobs.length === 0) {
          sendResponse({ success: false, error: "未找到岗位卡片" });
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
