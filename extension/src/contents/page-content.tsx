import type { PlasmoCSConfig } from "plasmo";
import { extractCurrentPageJobs } from "@/lib/extractor";
import { syncToNextJobs } from "@/lib/sync";

/**
 * Plasmo Content Script 配置
 * 在招聘网站页面注入
 */
export const config: PlasmoCSConfig = {
  matches: ["https://www.zhipin.com/*"],
  run_at: "document_idle",
};

/**
 * 监听来自 Popup 的消息
 * 消息协议:
 * - EXTRACT_AND_SYNC: 提取当前页面岗位并同步
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "EXTRACT_AND_SYNC") {
    (async () => {
      try {
        console.log("[JobRadar] Starting extraction...");

        const jobs = extractCurrentPageJobs();

        if (jobs.length === 0) {
          console.log("[JobRadar] No job cards detected");
          sendResponse({
            success: false,
            error: "当前页面未检测到职位卡片，请确认在职位列表页",
          });
          return;
        }

        console.log(
          `[JobRadar] Extracted ${jobs.length} jobs, syncing...`
        );

        const result = await syncToNextJobs(jobs);

        if (result.success) {
          sendResponse({
            success: true,
            count: result.count ?? jobs.length,
            ingested: result.ingested,
            updated: result.updated,
          });
        } else {
          sendResponse({
            success: false,
            error: result.error || "同步失败",
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        console.error("[JobRadar] Extraction error:", err);
        sendResponse({ success: false, error: message });
      }
    })();

    return true;
  }

  if (msg.action === "CHECK_PAGE") {
    sendResponse({
      success: true,
      isListPage: isJobListPage(),
      isDetailPage: isJobDetailPage(),
      title: document.title,
      url: window.location.href,
    });
    return true;
  }
});

export default () => null;

function isJobListPage(): boolean {
  const url = window.location.href;
  if (url.includes("/web/geek/job")) return true;
  if (url.includes("/web/geek/search")) return true;

  const cards = document.querySelectorAll(
    ".job-card-wrapper, .job-card-box, [class*='job-card']"
  );
  return cards.length >= 3;
}

function isJobDetailPage(): boolean {
  const url = window.location.href;
  return url.includes("/job_detail/");
}
