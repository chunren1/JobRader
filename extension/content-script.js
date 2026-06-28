/**
 * JobRadar Content Script v5
 * 核心: 从卡片原始文本直接解析所有字段
 */
var NEXTJS_URL = "http://localhost:3000";
var LOCAL_SECRET = "job-radar-local-dev-secret-change-me";

// ============================================
// 薪资解码 - 从渲染结果获取真实数字
// ====================================
var fontMap = null;

function buildFontMap() {
  if (fontMap) return;
  fontMap = {};
  try {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules || sheets[i].rules;
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var text = rules[j].cssText || "";
          // 找 Boss 自定义字体文件 URL
          if (text.indexOf("@font-face") > -1 && (text.indexOf("boss") > -1 || text.indexOf("zhipin") > -1 || text.indexOf("job-search") > -1 || text.indexOf(".woff") > -1)) {
            // 提取 font-family 名称
            var ffm = text.match(/font-family:\s*"?([^";]+)/);
            if (ffm) {
              var ffName = ffm[1].trim();
              // 在页面中找到使用这个字体的元素
              var els = document.querySelectorAll("*");
              for (var k = 0; k < Math.min(els.length, 500); k++) {
                var style = window.getComputedStyle(els[k]);
                if (style.fontFamily && style.fontFamily.indexOf(ffName) > -1) {
                  var txt = (els[k].textContent || "").trim();
                  if (txt.length >= 1 && txt.length <= 3) {
                    // 临时换字体看真实字符
                    var orig = els[k].style.fontFamily;
                    els[k].style.fontFamily = "Arial, sans-serif";
                    var realChar = els[k].textContent.trim();
                    els[k].style.fontFamily = orig;
                    // 检查 realChar 是否为数字
                    if (/^\d$/.test(realChar)) {
                      fontMap[txt] = realChar;
                    }
                  }
                }
              }
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {}
  console.log("[JobRadar] Font map:", JSON.stringify(fontMap));
}

function decodeSalaryText(raw) {
  buildFontMap();
  // 查找原始文本中的薪资行
  // 常见模式: 内容 数字-数字元/天 或 内容 数字K-数字K
  var result = { min: null, max: null };

  // 方法1: 用字体映射解码
  if (Object.keys(fontMap).length > 0) {
    var decoded = raw;
    for (var k in fontMap) {
      decoded = decoded.split(k).join(fontMap[k]);
    }
    // 从decode后文本提取数字
    var m = decoded.match(/(\d+)[-~](\d+)\s*元\/天/);
    if (m) { return { min: parseInt(m[1]) * 22, max: parseInt(m[2]) * 22 }; }
    m = decoded.match(/(\d+)[-~](\d+)\s*[kK]/);
    if (m) { return { min: parseInt(m[1]) * 1000, max: parseInt(m[2]) * 1000 }; }
    m = decoded.match(/(\d+)[-~](\d+)\s*万/);
    if (m) { return { min: parseInt(m[1]) * 10000, max: parseInt(m[2]) * 10000 }; }
  }

  // 方法2: 从纯数字范围匹配
  var m2 = raw.match(/(\d{4,6})\s*[-~]\s*(\d{4,6})/);
  if (m2) return { min: parseInt(m2[1]), max: parseInt(m2[2]) };

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
// 主入口
// ============================================
function extractJobs() {
  buildFontMap();
  var url = window.location.href;
  if (url.indexOf("job_detail") !== -1) {
    var job = extractFromDetailPage();
    return job ? [job] : [];
  }
  return extractFromListPage();
}

function extractFromDetailPage() {
  var title = document.title.split(/[-_|]/)[0].trim() || "";
  if (!title) return null;

  var companyEl = document.querySelector("[class*='company'] [class*='name'], .company-name");
  var company = companyEl ? cleanText(companyEl.innerText || companyEl.textContent) : "未知";

  var salEl = document.querySelector(".salary, [class*='salary']");
  var salary = decodeSalaryText(salEl ? (salEl.innerText || salEl.textContent) : "");

  var locEl = document.querySelector("[class*='area'], [class*='location']");
  var location = "未知";
  if (locEl) { var cm = (locEl.innerText || "").match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安/); if (cm) location = cm[0]; }

  var jdEl = document.querySelector(".job-detail, .job-sec-text, [class*='job-detail'], [class*='job-sec']");
  var jd = jdEl ? cleanText(jdEl.innerText || jdEl.textContent) : "";
  if (jd.length < 50) jd = cleanText(document.body.innerText).substring(0, 2000);

  var tags = [];
  document.querySelectorAll(".tag-item li, [class*='tag-item']").forEach(function(el) {
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
// 列表页 - 从卡片原始文本解析所有字段
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
      var link = card.querySelector("a[href*='job_detail'], a[href*='job/'], .job-name a");
      if (!link) link = card.querySelector("a[href]");
      var href = link ? (link.href || link.getAttribute("href") || "") : "";
      if (!href || href.length < 15 || seen[href]) return;
      seen[href] = true;

      // 原始文本
      var raw = (card.innerText || card.textContent || "").replace(/\s+/g, " ").trim();
      if (raw.length < 10) return;

      // 解析标题
      var title = "";
      var tEl = card.querySelector(".job-name, .job-title, [class*='job-name']");
      if (tEl) title = cleanText(tEl.innerText || tEl.textContent);
      if (!title) {
        // 从原始文本：取第一个非数字开头的短行
        var lines = raw.split(/\s+/);
        for (var l = 0; l < lines.length; l++) {
          if (lines[l].length > 1 && !/^\d/.test(lines[l]) && lines[l].length < 50) {
            title = lines[l]; break;
          }
        }
      }
      if (!title) return;

      // === 从原始文本解析所有字段 ===
      // 模式: {title} {salary} {schedule} {edu} {tags} {company} {location·district}

      // 薪资: 取原始文本中的薪资片段
      var salary = decodeSalaryText(raw);

      // 公司+地点: 找 "公司名 城市·区" 模式
      var company = "未知", location = "未知";

      // 更宽松的模式
      var cityPat = /(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州|东莞|合肥|佛山|福州|青岛|大连)(·|\u00b7|区|市)/;
      var cm = raw.match(cityPat);
      if (cm) {
        location = cm[1];
        var idx = cm.index;
        // 城市前的词: 找到空格或分隔符前的最后一个2-20字符段
        var before = raw.substring(0, idx).trim();
        var words = before.split(/\s+/);
        // 从后往前找第一个像公司名的词
        for (var w = words.length - 1; w >= 0; w--) {
          var word = words[w];
          if (word.length >= 2 && word.length <= 20 && !/^\d/.test(word) && !/元\/天|[kK]|万|本科|大专|硕士|周|月|经验/.test(word) && word !== title) {
            company = word;
            break;
          }
        }
      }

      // 如果公司没找到，用选择器
      if (company === "未知") {
        var cEl = card.querySelector(".company-name, .company-text, [class*='company'], .cname");
        if (cEl) company = cleanText(cEl.innerText || cEl.textContent);
      }

      // 地点兜底
      if (location === "未知") {
        var lEl = card.querySelector(".job-area, .area, [class*='area']");
        var lText = lEl ? (lEl.innerText || lEl.textContent) : "";
        var lm = lText.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门|苏州|长沙|天津|重庆|郑州/);
        if (!lm) lm = raw.match(/北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|厦门/);
        if (lm) location = lm[0];
      }

      // 标签: 从原始文本提取技术关键词
      var techs = ["Java", "Spring", "SpringBoot", "SpringCloud", "MySQL", "Redis", "MongoDB", "Docker", "K8s", "Kubernetes", "Go", "Golang", "Python", "React", "Vue", "TypeScript", "JavaScript", "Node", "Nginx", "Linux", "MyBatis", "Hibernate", "JVM", "微服务"];
      var tags = [];
      techs.forEach(function(t) {
        if (raw.indexOf(t) !== -1 && tags.indexOf(t) === -1) tags.push(t);
      });

      // 也把 card 内 tag 元素的内容加上
      card.querySelectorAll("[class*='tag']").forEach(function(el) {
        var t = cleanText(el.innerText || el.textContent);
        if (t && t.length < 15 && tags.indexOf(t) === -1) tags.push(t);
      });

      var jd = raw.length > 800 ? raw.substring(0, 800) : raw;
      var rawUrl = href.startsWith("http") ? href : "https://www.zhipin.com" + (href.startsWith("/") ? "" : "/") + href;

      jobs.push({
        title: title, company: company,
        salaryMin: salary.min, salaryMax: salary.max,
        location: location, jdContent: jd,
        tags: tags, rawUrl: rawUrl, source: "platform"
      });

    } catch (e) { console.warn("[JobRadar] card err:", e.message); }
  });

  console.log("[JobRadar] List: " + jobs.length + " jobs, fontMap size: " + Object.keys(fontMap||{}).length);
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
        console.log("[JobRadar] Extracted " + jobs.length + " jobs");

        if (jobs.length > 0) {
          console.log("[JobRadar] Sample:", jobs[0]);
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
    sendResponse({ success: true, isListPage: count >= 3, linkCount: count });
    return true;
  }
});
