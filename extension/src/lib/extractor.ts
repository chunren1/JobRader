import type { JobIngestData } from "./sync";

/**
 * 从招聘网站职位页面提取岗位信息
 * 
 * 规则说明：基于 DOM 选择器提取，不破解任何加密参数
 * 仅在用户主动触发时运行（Popup 按钮点击）
 */
export function extractCurrentPageJobs(): JobIngestData[] {
  const jobs: JobIngestData[] = [];

  // 招聘网站列表页的卡片选择器 (需根据实际页面结构调整)
  const jobCards = document.querySelectorAll(
    ".job-card-wrapper, .job-card-box, [class*='job-card']"
  );

  // 如果列表页选择器未命中，尝试详情页提取
  if (jobCards.length === 0) {
    const singleJob = extractSingleJob();
    if (singleJob) {
      jobs.push(singleJob);
    }
    return jobs;
  }

  jobCards.forEach((card) => {
    try {
      // 提取岗位名称
      const titleEl = card.querySelector(
        ".job-name, .job-title, [class*='job-name']"
      );
      const title = titleEl?.textContent?.trim() ?? "";

      // 提取公司名称
      const companyEl = card.querySelector(
        ".company-name, .company-text, [class*='company-name']"
      );
      const company = companyEl?.textContent?.trim() ?? "";

      // 提取薪资文本并解析
      const salaryEl = card.querySelector(
        ".salary, .red, [class*='salary']"
      );
      const salaryText = salaryEl?.textContent?.trim() ?? "";
      const { min, max } = parseSalary(salaryText);

      // 提取工作地点
      const locationEl = card.querySelector(
        ".job-area, .area, [class*='area']"
      );
      const location =
        locationEl?.textContent?.trim().split("\n")[0]?.trim() ?? "未知";

      // 提取职位描述（列表页通常只有简短描述）
      const jdEl = card.querySelector(
        ".job-info, .info-desc, [class*='desc']"
      );
      const jdContent = jdEl?.textContent?.trim() ?? "";

      // 提取标签
      const tagEls = card.querySelectorAll(
        ".tag-item, .item-tag, [class*='tag']"
      );
      const tags: string[] = [];
      tagEls.forEach((el) => {
        const t = el.textContent?.trim();
        if (t && t.length < 30) tags.push(t);
      });

      // 提取链接
      const linkEl = card.querySelector("a[href*='job_detail']");
      const href = linkEl?.getAttribute("href") ?? "";
      const rawUrl = href.startsWith("http")
        ? href
        : `https://www.zhipin.com${href}`;

      if (title && company && rawUrl) {
        jobs.push({
          title,
          company,
          salaryMin: min,
          salaryMax: max,
          location,
          jdContent: jdContent || `${title} - ${company}`,
          tags,
          rawUrl,
          source: "platform",
        });
      }
    } catch (err) {
      console.warn("Failed to extract single job card:", err);
    }
  });

  console.log(
    `[JobRadar] Extracted ${jobs.length} jobs from current page`
  );
  return jobs;
}

/**
 * 提取单个岗位详情（详情页模式）
 */
function extractSingleJob(): JobIngestData | null {
  try {
    const titleEl = document.querySelector(
      ".name h1, .job-name h1, [class*='job-title']"
    );
    const title = titleEl?.textContent?.trim() ?? "";
    if (!title) return null;

    const companyEl = document.querySelector(
      ".company-name, .name a"
    );
    const company = companyEl?.textContent?.trim() ?? "";

    const salaryEl = document.querySelector(
      ".salary, .job-salary, [class*='salary']"
    );
    const salaryText = salaryEl?.textContent?.trim() ?? "";
    const { min, max } = parseSalary(salaryText);

    const locationEl = document.querySelector(
      "span:contains('城市'), .location"
    );
    const location = locationEl?.textContent?.trim() ?? "未知";

    const jdEl = document.querySelector(
      ".job-detail, .job-sec-text, [class*='job-detail']"
    );
    const jdContent = jdEl?.textContent?.trim() ?? `${title} - ${company}`;

    const tags: string[] = [];
    const tagEls = document.querySelectorAll(
      ".job-tag, .tag, [class*='skill']"
    );
    tagEls.forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length < 30) tags.push(t);
    });

    return {
      title,
      company,
      salaryMin: min,
      salaryMax: max,
      location,
      jdContent,
      tags,
      rawUrl: window.location.href,
      source: "platform",
    };
  } catch {
    return null;
  }
}

/**
 * 解析薪资文本为 min/max 范围
 * 支持格式: "30K-50K", "15k-25k·16薪", "2万-3万", "薪资面议"
 */
function parseSalary(text: string): {
  min: number | null;
  max: number | null;
} {
  if (!text) return { min: null, max: null };

  // 去掉 "·16薪" 等后缀
  const clean = text.replace(/·.*$/, "").trim();

  // 匹配 "30K-50K" 或 "30k-50k" 格式
  const rangeMatch = clean.match(
    /(\d+\.?\d*)\s*[kK万萬]?\s*[-~至到]\s*(\d+\.?\d*)\s*[kK万萬]/
  );
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1]);
    let max = parseFloat(rangeMatch[2]);

    // 判断单位：如果数字较小（< 100）可能是 K 单位
    if (clean.includes("万") || clean.includes("萬")) {
      min *= 10000;
      max *= 10000;
    } else if (clean.includes("K") || clean.includes("k")) {
      min *= 1000;
      max *= 1000;
    } else if (min < 100 && max < 500) {
      min *= 1000;
      max *= 1000;
    }

    return { min: Math.round(min), max: Math.round(max) };
  }

  // 匹配单个数值 "30K起" / "最高50K"
  const singleMatch = clean.match(/(\d+\.?\d*)\s*[kK万萬]/);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    if (clean.includes("万") || clean.includes("萬")) {
      val *= 10000;
    } else {
      val *= 1000;
    }
    return clean.includes("最高") || clean.includes("max")
      ? { min: null, max: Math.round(val) }
      : { min: Math.round(val), max: null };
  }

  return { min: null, max: null };
}
