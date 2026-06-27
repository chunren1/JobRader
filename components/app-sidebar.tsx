"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Heart, LayoutDashboard, BarChart3, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  favoritedCount?: number;
  onRefresh?: () => void;
  resumeText?: string | null;
  resumeUploading?: boolean;
  onResumeUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasteResume?: () => void;
  onClearResume?: () => void;
}

export function AppSidebar({
  favoritedCount = 0,
  onRefresh,
  resumeText,
  resumeUploading,
  onResumeUpload,
  onPasteResume,
  onClearResume,
}: AppSidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { href: "/dashboard", label: "所有岗位", icon: LayoutDashboard, active: pathname === "/dashboard" },
    { href: "/resume", label: "简历分析", icon: User, active: pathname === "/resume" },
    { href: "/dashboard", label: "数据分析", icon: BarChart3, active: false, onClick: true },
    { href: "/dashboard", label: "我的收藏", icon: Heart, active: false, onClick: true, badge: favoritedCount },
  ];

  return (
    <aside className="border-b lg:border-b-0 lg:border-r lg:min-h-screen lg:w-60 flex-shrink-0">
      <div className="p-4 lg:p-6">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <Radar className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold tracking-tight">JobRadar</span>
        </Link>

        <nav className="space-y-1">
          {menuItems.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.badge && item.badge > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          {onResumeUpload && (
            <label className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground cursor-pointer hover:bg-secondary hover:text-foreground transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              {resumeUploading ? "上传中..." : resumeText ? "简历已加载 ✓" : "上传简历 (PDF/MD)"}
              <input type="file" accept=".pdf,.md,.txt" onChange={onResumeUpload} className="hidden" disabled={resumeUploading} />
            </label>
          )}
          {onPasteResume && (
            <button onClick={onPasteResume}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              粘贴简历文本
            </button>
          )}
          {resumeText && onClearResume && (
            <button onClick={onClearResume} className="w-full text-left rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">清除简历</button>
          )}
          {onRefresh && (
            <button onClick={onRefresh}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <RefreshCw className="h-4 w-4" />刷新数据
            </button>
          )}
        </div>

        {/* Resume Preview */}
        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {resumeText ? (
            <div>
              <div className="font-medium text-foreground mb-1">简历已加载 ({resumeText.length}字)</div>
              <details>
                <summary className="cursor-pointer hover:text-foreground">预览简历内容</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto text-[10px]">
                  {resumeText.substring(0, 500)}{resumeText.length > 500 ? "..." : ""}
                </pre>
              </details>
            </div>
          ) : (
            "上传简历后，AI 将基于真实简历深度匹配岗位"
          )}
        </div>
      </div>
    </aside>
  );
}
