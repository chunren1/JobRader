/**
 * JobRadar 后台 Service Worker
 * 
 * 功能:
 * - 管理插件图标状态
 * - 监听页面切换，更新图标提示
 * - 处理来自 Popup 和 Content Script 的消息
 */

// 插件安装/更新时的初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[JobRadar] Background service worker ${details.reason}`);

  // 设置默认配置
  chrome.storage.local.get("localSecret", (result) => {
    if (!result.localSecret) {
      chrome.storage.local.set({
        localSecret: "job-radar-local-dev-secret-change-me",
      });
    }
  });
});

// 监听标签页更新，动态切换插件图标状态
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateIconState(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateIconState(tabId);
  }
});

/**
 * 更新插件图标状态
 * - 在 Boss直聘页面显示彩色图标
 * - 在其他页面显示灰色图标
 */
async function updateIconState(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);

    if (tab.url?.includes("zhipin.com")) {
      // Boss直聘页面 — 激活状态
      chrome.action.setIcon({
        tabId,
        path: {
          "16": "assets/icon16.png",
          "32": "assets/icon32.png",
          "48": "assets/icon48.png",
          "128": "assets/icon128.png",
        },
      });
      chrome.action.setBadgeText({ tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: "#3B82F6",
      });
    } else {
      // 非 Boss直聘页面 — 非激活状态
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  } catch {
    // 标签页可能已关闭
  }
}

// 导出空对象以满足 Service Worker 模块要求
export {};
