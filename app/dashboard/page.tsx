"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Radar, Heart, LayoutDashboard, RefreshCw, Loader2, Trash2, CheckSquare, Square, BarChart3, User, Settings2, X, ExternalLink, Sliders } from "lucide-react";
import Link from "next/link";
import { cn, formatSalary } from "@/lib/utils";
import { useJobs, useToggleFavorite, type JobData } from "@/lib/hooks/use-jobs";
import { JobCard } from "@/components/job-card";
import { FilterBar } from "@/components/filter-bar";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { ResumeAnalysis } from "@/components/resume-analysis";
import { ScoringConfig } from "@/components/scoring-config";
import { Pagination } from "@/components/pagination";
import { PageSkeleton, JobCardSkeleton } from "@/components/skeleton";
import { toast } from "@/components/toast";

export default function Dashboard() {
  const {
    jobs,
    pagination,
    filters: availableFilters,
    loading,
    error,
    activeFilters,
    updateFilters,
    setPage,
    refetch,
  } = useJobs();

  const { toggle } = useToggleFavorite();
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "favorites" | "analytics" | "resume" | "scoring">("all");
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);

  // 加载简历
  useEffect(() => {
    fetch("/api/resume").then(r => r.json()).then(d => {
      if (d.success) setResumeText(d.data.text);
    }).catch(() => {});
  }, []);

  // 上传简历
  const handleResumeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) { setResumeText(data.data.text); toast("简历上传成功", "success"); }
      else toast(data.error || "上传失败", "error");
    } finally {
      setResumeUploading(false);
    }
  }, []);

  // 粘贴简历文本
  const handlePasteResume = useCallback(async () => {
    const text = prompt("请在下方粘贴简历内容：", "");
    if (!text || text.trim().length < 30) return;
    try {
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) { setResumeText(data.data.text); toast("简历已保存", "success"); }
      else toast("保存失败", "error");
    } catch { toast("保存失败", "error"); }
  }, []);

  // 清除简历
  // 自定义偏好（自然语言）
  const [prefsText, setPrefsText] = useState("");
  const [prefsSaving, setPrefsSaving] = useState(false);
  const prefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/preferences").then(r => r.json()).then(d => {
      if (d.success) setPrefsText(d.text || "");
    }).catch(() => {});
  }, []);

  // 输入后 1 秒自动保存
  const handlePrefsChange = useCallback((val: string) => {
    setPrefsText(val);
    if (prefsTimer.current !== null) clearTimeout(prefsTimer.current);
    prefsTimer.current = setTimeout(() => {
      setPrefsSaving(true);
      fetch("/api/preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: val }) })
        .finally(() => setPrefsSaving(false));
    }, 800);
  }, []);

  const handleClearResume = useCallback(async () => {
    await fetch("/api/resume", { method: "DELETE" }).catch(() => {});
    setResumeText(null);
  }, []);

  // 从岗位数据中提取收藏状态
  useEffect(() => {
    const ids = new Set<string>();
    jobs.forEach((job) => {
      if (job.favorites?.some((f) => !f.deletedAt)) {
        ids.add(job.id);
      }
    });
    setFavoritedIds(ids);
  }, [jobs]);

  const handleToggleFavorite = useCallback(
    async (jobId: string) => {
      try {
        await toggle(jobId);
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          if (next.has(jobId)) {
            next.delete(jobId);
          } else {
            next.add(jobId);
          }
          return next;
        });
      } catch {
        // 乐观更新已在 JobCard 中处理
      }
    },
    [toggle]
  );

  const handleDelete = useCallback(
    async (jobId: string) => {
      // 乐观移除：立即从列表中去掉
      setFavoritedIds((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
      await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [jobId] }),
      });
      refetch();
    },
    [refetch]
  );

  const toggleSelect = useCallback((jobId: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(jobId) ? n.delete(jobId) : n.add(jobId);
      return n;
    });
  }, []);

  const displayJobs =
    viewMode === "favorites"
      ? jobs.filter((j) => favoritedIds.has(j.id))
      : jobs;

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(displayJobs.map(j => j.id)));
  }, [displayJobs]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    const count = selectedIds.size;
    try {
      const ids = Array.from(selectedIds);
      await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setSelectedIds(new Set());
      refetch();
      toast(`已删除 ${count} 个岗位`, "success");
    } catch {
      toast("删除失败", "error");
    } finally {
      setBatchDeleting(false);
    }
  }, [selectedIds, refetch]);

  // 单岗位重评
  const handleReanalyze = useCallback(async (jobId: string) => {
    toast("已提交重评", "info");
    await fetch("/api/workers/reanalyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    setTimeout(refetch, 5000);
  }, [refetch]);

  // 导出CSV
  const handleExport = useCallback(() => {
    window.open("/api/jobs/export", "_blank");
    toast("正在下载...", "success");
  }, []);

  // 对比选中
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const handleCompare = useCallback(() => {
    const ids = Array.from(selectedIds).slice(0, 2);
    if (ids.length < 2) { toast("请至少选择 2 个岗位进行对比", "error"); return; }
    setCompareIds(ids);
  }, [selectedIds]);

  const handleTagClick = useCallback(
    (tag: string) => {
      updateFilters({ search: tag });
    },
    [updateFilters]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar + Main Layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="border-b lg:border-b-0 lg:border-r lg:min-h-screen lg:w-60 flex-shrink-0">
          <div className="p-4 lg:p-6">
            {/* Logo */}
            <Link href="/" className="mb-8 flex items-center gap-3">
              <Radar className="h-7 w-7 text-primary" />
              <span className="text-lg font-bold tracking-tight">
                JobRadar
              </span>
            </Link>

            {/* Navigation */}
            <nav className="space-y-1">
              <button
                onClick={() => setViewMode("all")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                所有岗位
              </button>

              <button
                onClick={() => setViewMode("resume")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  viewMode === "resume"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <User className="h-4 w-4" />
                简历分析
              </button>

              <button
                onClick={() => setViewMode("scoring")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  viewMode === "scoring"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Sliders className="h-4 w-4" />
                AI 评分配置
              </button>

              <button
                onClick={() => setViewMode("analytics")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  viewMode === "analytics"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                数据分析
              </button>

              <button
                onClick={() => setViewMode("favorites")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  viewMode === "favorites"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Heart className="h-4 w-4" />
                我的收藏
                {favoritedIds.size > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {favoritedIds.size}
                  </span>
                )}
              </button>
            </nav>

            {/* Quick Actions */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleExport}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                导出 CSV
              </button>
              <button
                onClick={refetch}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
                刷新数据
              </button>
            </div>

            
            <div className="mt-6 space-y-2">
              <label className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground cursor-pointer hover:bg-secondary hover:text-foreground transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                {resumeUploading ? "上传中..." : "上传简历 (PDF/MD)"}
                <input type="file" accept=".pdf,.md,.txt" onChange={handleResumeUpload} className="hidden" disabled={resumeUploading} />
              </label>
              <button
                onClick={handlePasteResume}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                粘贴简历文本
              </button>
              {resumeText && (
                <button onClick={handleClearResume} className="w-full text-left rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">清除简历</button>
              )}
            </div>

            {/* User Preferences */}
            <div className="mt-6 space-y-2 px-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Settings2 className="h-3.5 w-3.5" />求职偏好
                {prefsSaving && <span className="text-[10px] animate-pulse">保存中...</span>}
              </div>
              <textarea
                value={prefsText}
                onChange={e => handlePrefsChange(e.target.value)}
                placeholder="想找什么样的岗位？例如：&#10;广州Java实习岗，不接受加班，远程优先"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:border-primary resize-none"
              />
              <p className="text-[10px] text-muted-foreground">用自然语言描述，AI 会自动理解你的偏好</p>
            </div>

          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-4 lg:p-8">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">
                {viewMode === "favorites" && "我的收藏"}
                {viewMode === "analytics" && "数据分析"}
                {viewMode === "resume" && "简历分析"}
                {viewMode === "scoring" && "AI 评分配置"}
                {viewMode === "all" && "岗位看板"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {viewMode === "favorites" && `${favoritedIds.size} 个已收藏岗位`}
                {viewMode === "analytics" && `${pagination.total} 个岗位，${jobs.filter(j => j.aiScore !== null).length} 个已分析`}
                {viewMode === "all" && `共 ${pagination.total} 个岗位待筛选`}
              </p>
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                加载失败: {error}
                <button
                  onClick={refetch}
                  className="ml-3 font-medium underline hover:no-underline"
                >
                  重试
                </button>
              </div>
            )}

            {/* Analytics Section */}
            {/* Non-list views */}
            {viewMode === "scoring" && <div className="animate-fade-in"><ScoringConfig /></div>}
            {viewMode === "resume" && <div className="animate-fade-in"><ResumeAnalysis /></div>}

            {/* Job Comparison Modal */}
            {compareIds.length === 2 && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCompareIds([])}>
                <div className="bg-background rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">岗位对比</h2>
                    <button onClick={() => setCompareIds([])} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {compareIds.map(id => {
                      const job = jobs.find(j => j.id === id);
                      if (!job) return null;
                      return (
                        <div key={id} className="border rounded-xl p-4 space-y-2 text-sm">
                          <h3 className="font-semibold">{job.title}</h3>
                          <div className="text-muted-foreground">{job.company} · {job.location}</div>
                          <div className="text-lg font-bold">{formatSalary(job.salaryMin, job.salaryMax)}</div>
                          <div className="text-xl font-bold text-primary">{job.aiScore}分</div>
                          <div className="text-xs text-muted-foreground">{job.aiSummary}</div>
                          {job.aiTechMatch?.length > 0 && <div className="flex flex-wrap gap-1">{job.aiTechMatch.map(s => <span key={s} className="rounded bg-primary/10 px-2 py-0.5 text-xs">{s}</span>)}</div>}
                          <a href={job.rawUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">查看 <ExternalLink className="h-3 w-3" /></a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Salary Trend - Analytics page */}
            {viewMode === "analytics" && jobs.length > 0 && (() => {
              const locSal: Record<string, { total: number; count: number }> = {};
              jobs.forEach(j => {
                const avg = j.salaryMin && j.salaryMax ? (j.salaryMin + j.salaryMax) / 2 / 1000 : 0;
                if (avg > 0 && j.location) {
                  if (!locSal[j.location]) locSal[j.location] = { total: 0, count: 0 };
                  locSal[j.location].total += avg;
                  locSal[j.location].count++;
                }
              });
              const data = Object.entries(locSal).map(([k, v]) => ({ name: k, avg: Math.round(v.total / v.count) })).sort((a, b) => b.avg - a.avg).slice(0, 8);
              return data.length > 0 ? (
                <div className="mt-6 rounded-xl border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-3">薪资趋势 (K/月)</h3>
                  <div className="space-y-2">
                    {data.map(d => (
                      <div key={d.name} className="flex items-center gap-3 text-sm">
                        <span className="w-16 text-right text-muted-foreground">{d.name}</span>
                        <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all flex items-center justify-end px-2" style={{ width: Math.max((d.avg / (data[0]?.avg || 1)) * 100, 5) + "%" }}>
                            <span className="text-xs text-primary-foreground font-medium">{d.avg}K</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {viewMode === "analytics" && (
              <div className="animate-fade-in">
                {loading ? <PageSkeleton /> : (
                  <AnalyticsCharts jobs={jobs} />
                )}
              </div>
            )}

            {/* Filter Bar — 分析模式不显示 */}
            {viewMode !== "analytics" && (
              <div className="mb-6">
                <FilterBar
                  locations={availableFilters.locations}
                  activeFilters={activeFilters}
                  onFilterChange={updateFilters}
                />
              </div>
            )}

            {/* Job List — 分析模式不显示 */}
            {viewMode === "analytics" ? null : loading ? (
              <PageSkeleton />
            ) : displayJobs.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Radar className="mb-4 h-16 w-16 text-muted-foreground/40" />
                <h3 className="mb-2 text-lg font-semibold">
                  {viewMode === "favorites"
                    ? "还没有收藏岗位"
                    : "暂无匹配的岗位"}
                </h3>
                <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                  {viewMode === "favorites"
                    ? "点击岗位卡片上的心形图标即可收藏。收藏后可以添加自定义笔记和标签。"
                    : "使用 Chrome 插件提取岗位数据，或调整筛选条件"}
                </p>
                {viewMode !== "favorites" && (
                  <button
                    onClick={() =>
                      updateFilters({
                        location: undefined,
                        minScore: undefined,
                        recommendation: undefined,
                        search: undefined,
                      })
                    }
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    清除所有筛选
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Batch Toolbar */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={selectedIds.size === displayJobs.length ? clearSelection : selectAll}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {selectedIds.size === displayJobs.length && displayJobs.length > 0
                      ? <CheckSquare className="h-4 w-4 text-primary" />
                      : <Square className="h-4 w-4" />}
                    全选 {displayJobs.length} 项
                  </button>
                  {selectedIds.size > 0 && (
                    <span className="text-xs text-muted-foreground">
                      已选 {selectedIds.size} 项
                    </span>
                  )}
                  {selectedIds.size >= 2 && (
                    <button onClick={handleCompare}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/></svg>
                      对比
                    </button>
                  )}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleBatchDelete}
                      disabled={batchDeleting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {batchDeleting
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      删除选中
                    </button>
                  )}
                </div>

                {/* Job Cards Grid */}
                <div className="grid gap-4">
                  {displayJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSelected={selectedIds.has(job.id)}
                      onToggleSelect={() => toggleSelect(job.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                      onReanalyze={handleReanalyze}
                      onTagClick={handleTagClick}
                      isFavorited={favoritedIds.has(job.id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="mt-6">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
