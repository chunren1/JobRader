"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * 岗位数据类型
 */
export interface JobData {
  id: string;
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  location: string;
  jdContent: string;
  tags: string[];
  rawUrl: string;
  source: string;
  aiScore: number | null;
  aiSummary: string | null;
  aiRecommendation: string | null;
  aiTechMatch: string[];
  aiRedFlags: string[];
  aiSalaryMatch: string | null;
  aiDimensions: Record<string, number> | null;
  analyzedAt: string | null;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
  favorites: { id: string; jobId: string; deletedAt: string | null }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Filters {
  locations: string[];
}

/**
 * 筛选参数类型
 */
export interface JobFilters {
  location?: string;
  minScore?: string;
  recommendation?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * 岗位数据 Hook
 */
export function useJobs(initialFilters: JobFilters = {}) {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<Filters>({ locations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<JobFilters>(initialFilters);

  const fetchJobs = useCallback(async (params: JobFilters) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params.location) searchParams.set("location", params.location);
      if (params.minScore) searchParams.set("minScore", params.minScore);
      if (params.recommendation) searchParams.set("recommendation", params.recommendation);
      if (params.search) searchParams.set("search", params.search);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));

      const url = `/api/jobs?${searchParams.toString()}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error("Failed to fetch jobs");

      const data = await res.json();

      if (data.success) {
        setJobs(data.data);
        setPagination(data.pagination);
        setFilters(data.filters);
      } else {
        throw new Error(data.error || "Failed to fetch jobs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(activeFilters);
  }, [activeFilters, fetchJobs]);

  const updateFilters = useCallback((newFilters: Partial<JobFilters>) => {
    setActiveFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: newFilters.page ?? 1, // 更改筛选条件时重置到第一页
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setActiveFilters((prev) => ({ ...prev, page }));
  }, []);

  return {
    jobs,
    pagination,
    filters,
    loading,
    error,
    activeFilters,
    updateFilters,
    setPage,
    refetch: () => fetchJobs(activeFilters),
  };
}

/**
 * 收藏切换 Hook
 */
export function useToggleFavorite() {
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(
    async (jobId: string): Promise<"favorited" | "unfavorited"> => {
      setLoading(true);
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        return data.action;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { toggle, loading };
}
