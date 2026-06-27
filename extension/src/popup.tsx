import { useState, useEffect, useCallback } from "react";
import { checkServiceHealth } from "@/lib/sync";

/**
 * Popup 同步状态
 */
type SyncStatus =
  | "checking"
  | "offline"
  | "idle"
  | "extracting"
  | "syncing"
  | "success"
  | "error";

export default function Popup() {
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [count, setCount] = useState(0);
  const [ingested, setIngested] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // 检查本地服务状态
  useEffect(() => {
    checkServiceHealth().then((healthy) => {
      setStatus(healthy ? "idle" : "offline");
      if (!healthy) {
        setErrorMsg(
          "未检测到 JobRadar 本地服务，请先启动 Next.js 项目 (npm run dev)"
        );
      }
    });
  }, []);

  /**
   * 触发岗位提取与同步
   */
  const handleExtractAndSync = useCallback(async () => {
    setStatus("extracting");
    setCount(0);
    setIngested(0);
    setUpdated(0);
    setErrorMsg("");

    try {
      // 获取当前活跃标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id) {
        throw new Error("无法获取当前标签页");
      }

      if (!tab.url?.includes("zhipin.com")) {
        throw new Error("请在职位列表页使用此工具");
      }

      // 先检查页面类型
      const pageCheck = await chrome.tabs.sendMessage(tab.id, {
        action: "CHECK_PAGE",
      });
      if (
        !pageCheck?.isListPage &&
        !pageCheck?.isDetailPage
      ) {
        throw new Error(
          "当前页面未检测到职位列表，请打开招聘网站搜索/推荐页面"
        );
      }

      // 发送提取消息
      setStatus("extracting");

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "EXTRACT_AND_SYNC",
      });

      if (response?.success) {
        setCount(response.count ?? 0);
        setIngested(response.ingested ?? 0);
        setUpdated(response.updated ?? 0);
        setStatus("success");

        // 3 秒后恢复空闲状态
        setTimeout(() => {
          setStatus("idle");
        }, 5000);
      } else {
        throw new Error(response?.error || "提取失败");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "未知错误";
      setStatus("error");
      setErrorMsg(message);
    }
  }, []);

  /**
   * 打开 Dashboard
   */
  const handleOpenDashboard = useCallback(() => {
    chrome.tabs.create({ url: "http://localhost:3000/dashboard" });
  }, []);

  return (
    <div className="w-[320px] p-4 space-y-4 font-sans text-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <svg
            className="h-5 w-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-800">
            JobRadar
          </h1>
          <p className="text-xs text-gray-500">个人效率助手</p>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="rounded-lg bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-xs">
          {/* Status Dot */}
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status === "offline"
                ? "bg-red-400"
                : status === "checking"
                  ? "bg-yellow-400 animate-pulse"
                  : status === "extracting" ||
                      status === "syncing"
                    ? "bg-blue-400 animate-pulse"
                    : status === "success"
                      ? "bg-green-400"
                      : status === "error"
                        ? "bg-red-400"
                        : "bg-green-400"
            }`}
          />

          <span className="text-gray-600">
            {status === "checking" && "正在检查服务状态..."}
            {status === "offline" && "❌ 本地服务离线"}
            {status === "idle" && "✅ 本地服务已连接，准备就绪"}
            {status === "extracting" && "⏳ 正在提取当前页面岗位..."}
            {status === "syncing" && "🔄 正在同步至本地数据库..."}
            {status === "success" &&
              `✅ 成功同步 ${count} 个岗位！AI 正在后台分析中`}
            {status === "error" && `❌ ${errorMsg}`}
          </span>
        </div>

        {/* Detail on success */}
        {status === "success" && (ingested > 0 || updated > 0) && (
          <div className="mt-2 text-xs text-gray-500 space-x-3">
            {ingested > 0 && (
              <span>新增 {ingested} 个</span>
            )}
            {updated > 0 && <span>更新 {updated} 个</span>}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Extract & Sync Button */}
        <button
          onClick={handleExtractAndSync}
          disabled={
            status === "extracting" ||
            status === "syncing" ||
            status === "offline" ||
            status === "checking"
          }
          className={`w-full py-2.5 px-4 rounded-lg text-white font-medium text-sm transition-all ${
            status === "extracting" ||
            status === "syncing"
              ? "bg-blue-400 cursor-wait"
              : status === "offline" || status === "checking"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98]"
          }`}
        >
          {status === "extracting" || status === "syncing"
            ? "处理中..."
            : status === "checking"
              ? "检查服务中..."
              : "提取并同步当前页面"}
        </button>

        {/* Open Dashboard */}
        <button
          onClick={handleOpenDashboard}
          className="w-full py-2.5 px-4 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm transition-all hover:bg-gray-50 active:bg-gray-100"
        >
          打开岗位看板
        </button>
      </div>

      {/* Restart Hint */}
      {status === "offline" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium mb-1">💡 如何启动本地服务？</p>
          <code className="block bg-amber-100/50 px-2 py-1 rounded mt-1">
            cd job-radar && npm run dev
          </code>
          <p className="mt-1 text-amber-700">
            服务启动后将运行在 http://localhost:3000
          </p>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-gray-400">
        仅在当前页面手动触发 · 数据仅存储于本地
      </p>
    </div>
  );
}
