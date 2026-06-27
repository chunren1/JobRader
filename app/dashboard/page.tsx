"use client";

import { useState, useCallback, useEffect } from "react";
import { Radar, Heart, LayoutDashboard, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useJobs, useToggleFavorite, type JobData } from "@/lib/hooks/use-jobs";
import { JobCard } from "@/components/job-card";
import { FilterBar } from "@/components/filter-bar";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { Pagination } from "@/components/pagination";

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
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "favorites">("all");

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

  const handleTagClick = useCallback(
    (tag: string) => {
      updateFilters({ search: tag });
    },
    [updateFilters]
  );

  const displayJobs =
    viewMode === "favorites"
      ? jobs.filter((j) => favoritedIds.has(j.id))
      : jobs;

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
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  showAnalytics
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 3v18h18" />
                  <path d="M7 16l4-8 4 4 4-6" />
                </svg>
                数据分析
              </button>

              <button
                onClick={refetch}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
                刷新数据
              </button>
            </div>

            {/* Info */}
            <div className="mt-6 rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              通过 Chrome 插件提取岗位，AI 自动分析评分，助你高效决策
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl p-4 lg:p-8">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">
                {viewMode === "favorites" ? "我的收藏" : "岗位看板"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {viewMode === "favorites"
                  ? `${favoritedIds.size} 个已收藏岗位`
                  : `共 ${pagination.total} 个岗位待筛选`}
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
            {showAnalytics && !loading && !error && (
              <div className="mb-6 animate-fade-in">
                <AnalyticsCharts jobs={jobs} />
              </div>
            )}

            {/* Filter Bar */}
            <div className="mb-6">
              <FilterBar
                locations={availableFilters.locations}
                activeFilters={activeFilters}
                onFilterChange={updateFilters}
              />
            </div>

            {/* Job List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">加载岗位数据...</span>
              </div>
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
                {/* Job Cards Grid */}
                <div className="grid gap-4">
                  {displayJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onToggleFavorite={handleToggleFavorite}
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
