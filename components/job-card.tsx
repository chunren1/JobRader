"use client";

import { useState, useCallback } from "react";
import {
  Heart,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Loader2,
} from "lucide-react";
import { cn, formatSalary, formatTimeAgo } from "@/lib/utils";
import { ScoreBadge, RecommendationBadge, SalaryMatchBadge } from "./status-badge";
import type { JobData } from "@/lib/hooks/use-jobs";
import type { JobFilters } from "@/lib/hooks/use-jobs";

interface JobCardProps {
  job: JobData;
  onToggleFavorite: (jobId: string) => Promise<void>;
  onTagClick?: (tag: string) => void;
  isFavorited: boolean;
}

export function JobCard({
  job,
  onToggleFavorite,
  onTagClick,
  isFavorited,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [optimisticFav, setOptimisticFav] = useState(isFavorited);

  const handleToggleFav = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setOptimisticFav((prev) => !prev); // 乐观更新
      setFavoriteLoading(true);
      try {
        await onToggleFavorite(job.id);
      } catch {
        setOptimisticFav((prev) => !prev); // 失败回滚
      } finally {
        setFavoriteLoading(false);
      }
    },
    [job.id, onToggleFavorite]
  );

  // 点击标题跳转到原始岗位页面
  const handleOpenJob = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      window.open(job.rawUrl, "_blank", "noopener,noreferrer");
    },
    [job.rawUrl]
  );

  return (
    <div className="rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      <div className="p-5">
        {/* Header: Title + Score + Favorite — 点击标题跳转到岗位页面 */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div
            className="min-w-0 flex-1 cursor-pointer group"
            onClick={handleOpenJob}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") handleOpenJob(e as unknown as React.MouseEvent); }}
            aria-label={`打开 ${job.title} 的岗位页面`}
          >
            <div className="mb-1 flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              <ScoreBadge score={job.aiScore} />
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {job.company}
            </p>
          </div>

          <button
            onClick={handleToggleFav}
            disabled={favoriteLoading}
            className={cn(
              "flex-shrink-0 rounded-lg p-2 transition-colors z-10",
              favoriteLoading && "opacity-50"
            )}
            aria-label={optimisticFav ? "取消收藏" : "加入收藏"}
          >
            {favoriteLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : optimisticFav ? (
              <Heart className="h-5 w-5 fill-red-500 text-red-500" />
            ) : (
              <Heart className="h-5 w-5 text-muted-foreground hover:text-red-400" />
            )}
          </button>
        </div>

        {/* Meta: Salary + Location + Time */}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {formatSalary(job.salaryMin, job.salaryMax)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {job.location}
          </span>
          <span className="text-xs">{formatTimeAgo(job.fetchedAt)}</span>
        </div>

        {/* AI Analysis Summary */}
        {job.aiSummary && (
          <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground font-medium">AI:</span>{" "}
            {job.aiSummary}
          </div>
        )}

        {/* Tags */}
        {job.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Tag className="mr-1 h-3 w-3" />
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Badges Row */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          <RecommendationBadge level={job.aiRecommendation} />
          <SalaryMatchBadge match={job.aiSalaryMatch} />
          {job.aiRedFlags.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {job.aiRedFlags.length}个风险
            </span>
          )}
          {job.aiTechMatch.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              {job.aiTechMatch.length}项匹配
            </span>
          )}
        </div>

        {/* Expand Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              收起详情 <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              展开详情 <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* JD Content */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                职位描述
              </h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground line-clamp-8">
                {job.jdContent}
              </p>
            </div>

            {/* Red Flags */}
            {job.aiRedFlags.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-red-600">
                  风险提示
                </h4>
                <ul className="space-y-1">
                  {job.aiRedFlags.map((flag, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-red-700"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tech Match */}
            {job.aiTechMatch.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-green-600">
                  技术栈匹配
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {job.aiTechMatch.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Dimensions */}
            {job.aiDimensions && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  四维评分
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "tech", label: "技术匹配" },
                    { key: "salary", label: "薪资竞争力" },
                    { key: "stability", label: "公司稳定" },
                    { key: "growth", label: "成长空间" },
                  ].map((dim) => {
                    const score =
                      (job.aiDimensions as Record<string, number>)[dim.key] ?? 0;
                    return (
                      <div key={dim.key} className="text-center">
                        <div className="mb-1 text-lg font-bold">{score}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {dim.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
