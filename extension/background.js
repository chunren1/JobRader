/**
 * JobRadar 后台 Service Worker
 * 管理插件图标状态
 */

chrome.runtime.onInstalled.addListener(function (details) {
  console.log("[JobRadar] Service worker " + details.reason);
});

// 标签页切换时更新图标状态
chrome.tabs.onActivated.addListener(function (info) {
  updateIcon(info.tabId);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo.status === "complete") updateIcon(tabId);
});

async function updateIcon(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && tab.url.includes("zhipin.com")) {
      chrome.action.setBadgeText({ tabId: tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#3B82F6" });
    } else {
      chrome.action.setBadgeText({ tabId: tabId, text: "" });
    }
  } catch (e) { /* tab may be closed */ }
}
