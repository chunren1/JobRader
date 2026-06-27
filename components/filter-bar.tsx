"use client";

import { useState, useCallback } from "react";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobFilters } from "@/lib/hooks/use-jobs";

const RECOMMENDATION_OPTIONS = [
  { value: "", label: "全部" },
  { value: "强烈推荐", label: "强烈推荐" },
  { value: "可以考虑", label: "可以考虑" },
  { value: "不推荐", label: "不推荐" },
];

const SCORE_RANGES = [
  { value: "", label: "全部" },
  { value: "80", label: "80分以上" },
  { value: "60", label: "60分以上" },
  { value: "40", label: "40分以上" },
];

interface FilterBarProps {
  locations: string[];
  activeFilters: JobFilters;
  onFilterChange: (filters: Partial<JobFilters>) => void;
}

export function FilterBar({
  locations,
  activeFilters,
  onFilterChange,
}: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(activeFilters.search ?? "");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onFilterChange({ search: searchInput || undefined });
    },
    [searchInput, onFilterChange]
  );

  const clearSearch = useCallback(() => {
    setSearchInput("");
    onFilterChange({ search: undefined });
  }, [onFilterChange]);

  const hasActiveFilters =
    activeFilters.location ||
    activeFilters.minScore ||
    activeFilters.recommendation ||
    activeFilters.search;

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    onFilterChange({
      location: undefined,
      minScore: undefined,
      recommendation: undefined,
      search: undefined,
    });
  }, [onFilterChange]);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索岗位、公司、技术关键词..."
          className="w-full rounded-lg border bg-background py-2.5 pl-10 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          aria-label="搜索岗位"
        />
        {searchInput && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Location Filter */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <select
            value={activeFilters.location ?? ""}
            onChange={(e) =>
              onFilterChange({
                location: e.target.value || undefined,
              })
            }
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            aria-label="筛选城市"
          >
            <option value="">所有城市</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Score Filter */}
        <select
          value={activeFilters.minScore ?? ""}
          onChange={(e) =>
            onFilterChange({
              minScore: e.target.value || undefined,
            })
          }
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="筛选最低评分"
        >
          {SCORE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>

        {/* Recommendation Filter */}
        <select
          value={activeFilters.recommendation ?? ""}
          onChange={(e) =>
            onFilterChange({
              recommendation: e.target.value || undefined,
            })
          }
          className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          aria-label="筛选推荐等级"
        >
          {RECOMMENDATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            清除筛选
          </button>
        )}

        {/* Active Filter Indicator */}
        {hasActiveFilters && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <SlidersHorizontal className="h-3 w-3" />
            筛选已生效
          </span>
        )}
      </div>
    </div>
  );
}
