/**
 * JobRadar Content Script
 * 在招聘网站页面注入，负责提取岗位数据
 */

const NEXTJS_URL = "http://localhost:3000";
const LOCAL_SECRET = "job-radar-local-dev-secret-change-me";

// ============================================
// 薪资解析
// ============================================
function parseSalary(text) {
  if (!text) return { min: null, max: null };
  const clean = text.replace(/·.*$/, "").trim();

  const rangeMatch = clean.match(/(\d+\.?\d*)\s*[kK万萬]?\s*[-~至到]\s*(\d+\.?\d*)\s*[kK万萬]/);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);
    if (clean.includes("万") || clean.includes("萬")) {
      min *= 10000; max *= 10000;
    } else if (clean.includes("K") || clean.includes("k")) {
      min *= 1000; max *= 1000;
    } else if (min < 100 && max < 500) {
      min *= 1000; max *= 1000;
    }
    return { min: Math.round(min), max: Math.round(max) };
  }

  const singleMatch = clean.match(/(\d+\.?\d*)\s*[kK万萬]/);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    if (clean.includes("万") || clean.includes("萬")) val *= 10000;
    else val *= 1000;
    return clean.includes("最高") || clean.includes("max")
      ? { min: null, max: Math.round(val) }
      : { min: Math.round(val), max: null };
  }
  return { min: null, max: null };
}

// ============================================
// 岗位提取
// ============================================
function extractJobs() {
  const jobs = [];

  // 通用选择器：匹配各类招聘网站的岗位卡片
  const cards = document.querySelectorAll(
    ".job-card-wrapper, .job-card-box, [class*='job-card'], [class*='jobCard'], .job-primary, .job-info"
  );

  if (cards.length === 0) return jobs;

  cards.forEach(function (card) {
    try {
      const title = (card.querySelector(".job-name, .job-title, [class*='job-name'], [class*='jobTitle'], .name")?.textContent || "").trim();
      const company = (card.querySelector(".company-name, .company-text, [class*='company'], .cname")?.textContent || "").trim();
      const salaryText = (card.querySelector(".salary, .red, [class*='salary'], .badge")?.textContent || "").trim();
      const loc = (card.querySelector(".job-area, .area, [class*='area'], .location")?.textContent || "").trim().split("\n")[0].trim();
      const jd = (card.querySelector(".job-info, .info-desc, [class*='desc'], .text")?.textContent || "").trim();

      const tags = [];
      card.querySelectorAll(".tag-item, .item-tag, [class*='tag'], .skill").forEach(function (el) {
        const t = el.textContent.trim();
        if (t && t.length < 30) tags.push(t);
      });

      const link = card.querySelector("a[href*='job_detail'], a[href*='job/'], .job-name a, .job-title a");
      let href = link?.getAttribute("href") || window.location.href;
      if (href && !href.startsWith("http")) href = "https://www.zhipin.com" + href;

      const { min, max } = parseSalary(salaryText);

      if (title && company && href) {
        jobs.push({
          title, company,
          salaryMin: min, salaryMax: max,
          location: loc || "未知",
          jdContent: jd || (title + " - " + company),
          tags, rawUrl: href, source: "platform"
        });
      }
    } catch (e) { /* skip broken card */ }
  });

  return jobs;
}

// ============================================
// 同步到 Next.js
// ============================================
async function syncJobs(jobs) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(NEXTJS_URL + "/api/jobs/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Local-Secret": LOCAL_SECRET,
        },
        body: JSON.stringify({ jobs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(function() { return {}; });
        if (res.status === 401) return { success: false, error: "认证失败" };
        console.warn("[JobRadar] Sync attempt " + attempt + " failed:", err.error);
        if (attempt < 3) await new Promise(function(r) { setTimeout(r, 1000 * attempt); });
        continue;
      }
      const data = await res.json();
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
        const jobs = extractJobs();
        console.log("[JobRadar] Extracted " + jobs.length + " jobs");

        if (jobs.length === 0) {
          sendResponse({ success: false, error: "当前页面未检测到职位卡片，请确认在职位列表页" });
          return;
        }

        const result = await syncJobs(jobs);
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // 保持异步通道
  }

  if (msg.action === "CHECK_PAGE") {
    const cards = document.querySelectorAll(".job-card-wrapper, .job-card-box, [class*='job-card'], [class*='jobCard']");
    sendResponse({
      success: true,
      isListPage: cards.length >= 3,
      isDetailPage: window.location.href.includes("job_detail"),
      title: document.title,
      url: window.location.href,
    });
    return true;
  }
});
