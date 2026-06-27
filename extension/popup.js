var NEXTJS_URL = "http://localhost:3000";
var dot = document.getElementById("dot");
var txt = document.getElementById("text");
var detail = document.getElementById("detail");
var hint = document.getElementById("hint");
var btn = document.getElementById("extractBtn");

async function checkHealth() {
  try {
    var res = await fetch(NEXTJS_URL + "/api/health");
    if (res.ok) {
      dot.className = "dot green";
      txt.textContent = "本地服务已连接，准备就绪";
      btn.disabled = false;
      hint.style.display = "none";
      return true;
    }
  } catch (e) {}
  dot.className = "dot red";
  txt.textContent = "本地服务离线";
  detail.textContent = "请先启动 Next.js 项目 (npm run dev)";
  btn.disabled = true;
  hint.style.display = "block";
  return false;
}

btn.addEventListener("click", async function () {
  btn.disabled = true;
  dot.className = "dot blue";
  txt.textContent = "正在提取当前页面岗位...";
  detail.textContent = "";
  btn.textContent = "处理中...";

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];

    if (!tab.id) throw new Error("无法获取当前标签页");
    if (!tab.url || !tab.url.includes("zhipin.com")) {
      throw new Error("请在职位列表页使用此工具");
    }

    // 先检查页面是否有岗位链接
    var check = await chrome.tabs.sendMessage(tab.id, { action: "CHECK_PAGE" });
    if (check && check.linkCount < 3) {
      throw new Error("当前页面岗位链接不足（找到 " + (check.linkCount || 0) + " 个），请打开职位搜索/列表页");
    }

    var response = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_AND_SYNC" });

    if (response && response.success) {
      dot.className = "dot green";
      txt.textContent = "成功同步 " + response.count + " 个岗位！";
      var d = "";
      if (response.ingested > 0) d += "新增 " + response.ingested + " 个";
      if (response.updated > 0) d += (d ? "，" : "") + "更新 " + response.updated + " 个";
      detail.textContent = d + "，AI 正在后台分析中...";

      // 自动触发 AI 分析
      fetch(NEXTJS_URL + "/api/workers/ai-analyze", { method: "POST" }).catch(function(){});

      setTimeout(checkHealth, 5000);
    } else {
      throw new Error((response && response.error) || "提取失败");
    }
  } catch (err) {
    dot.className = "dot red";
    txt.textContent = err.message;
    detail.textContent = "";
  } finally {
    btn.disabled = false;
    btn.textContent = "提取并同步当前页面";
  }
});

document.getElementById("dashboardBtn").addEventListener("click", function () {
  chrome.tabs.create({ url: NEXTJS_URL + "/dashboard" });
});

checkHealth();
