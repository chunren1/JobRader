"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = generatePages(page, totalPages);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        共 {total} 条结果
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, i) => {
          if (p === "...") {
            return (
              <span
                key={`ellipsis-${i}`}
                className="px-2 text-sm text-muted-foreground"
              >
                ...
              </span>
            );
          }

          return (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
                page === Number(p)
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-secondary"
              )}
            >
              {p}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * 生成分页按钮编号
 */
function generatePages(
  current: number,
  total: number
): (string | number)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (string | number)[] = [];

  if (current <= 3) {
    pages.push(1, 2, 3, 4, 5, "...", total);
  } else if (current >= total - 2) {
    pages.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(
      1,
      "...",
      current - 1,
      current,
      current + 1,
      "...",
      total
    );
  }

  return pages;
}
