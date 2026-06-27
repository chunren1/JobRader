const NEXTJS_URL = "http://localhost:3000";
const dot = document.getElementById("statusDot");
const txt = document.getElementById("statusText");
const detail = document.getElementById("statusDetail");
const hint = document.getElementById("hintBox");
const btn = document.getElementById("extractBtn");

// 检查 Next.js 服务状态
async function checkHealth() {
  try {
    const res = await fetch(NEXTJS_URL + "/api/health");
    if (res.ok) {
      dot.className = "status-dot dot-green";
      txt.textContent = "✅ 本地服务已连接，准备就绪";
      btn.disabled = false;
      hint.style.display = "none";
      return true;
    }
  } catch (e) { /* offline */ }
  dot.className = "status-dot dot-red";
  txt.textContent = "❌ 本地服务离线";
  detail.textContent = "请先启动 Next.js 项目";
  btn.disabled = true;
  hint.style.display = "block";
  return false;
}

// 提取并同步
btn.addEventListener("click", async () => {
  btn.disabled = true;
  dot.className = "status-dot dot-blue";
  txt.textContent = "⏳ 正在提取当前页面岗位...";
  detail.textContent = "";
  btn.textContent = "处理中...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) throw new Error("无法获取当前标签页");
    if (!tab.url || !tab.url.includes("zhipin.com")) {
      throw new Error("请在职位列表页使用此工具");
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_AND_SYNC" });

    if (response?.success) {
      dot.className = "status-dot dot-green";
      txt.textContent = `✅ 成功同步 ${response.count} 个岗位！`;
      if (response.ingested > 0) detail.textContent = `新增 ${response.ingested} 个`;
      if (response.updated > 0) detail.textContent += (detail.textContent ? "， " : "") + `更新 ${response.updated} 个`;
      detail.textContent += "，AI 正在后台分析中";

      // 3 秒后恢复
      setTimeout(checkHealth, 5000);
    } else {
      throw new Error(response?.error || "提取失败");
    }
  } catch (err) {
    dot.className = "status-dot dot-red";
    txt.textContent = "❌ " + err.message;
    detail.textContent = "";
  } finally {
    btn.disabled = false;
    btn.textContent = "提取并同步当前页面";
  }
});

// 打开 Dashboard
document.getElementById("dashboardBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: NEXTJS_URL + "/dashboard" });
});

// 启动时检查
checkHealth();
