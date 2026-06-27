"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { JobData } from "@/lib/hooks/use-jobs";

const PIE_COLORS = {
  "强烈推荐": "#059669",
  "可以考虑": "#D97706",
  "不推荐": "#DC2626",
  未评分: "#9CA3AF",
};

const SCORE_BAR_COLOR = "#3B82F6";

interface AnalyticsChartsProps {
  jobs: JobData[];
}

export function AnalyticsCharts({ jobs }: AnalyticsChartsProps) {
  // AI 评分分布
  const scoreDistribution = useMemo(() => {
    const bins = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];

    return bins.map((bin) => ({
      name: bin.range,
      count: jobs.filter(
        (j) =>
          j.aiScore !== null &&
          j.aiScore >= bin.min &&
          j.aiScore <= bin.max
      ).length,
    }));
  }, [jobs]);

  // 推荐等级分布
  const recommendationDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      "强烈推荐": 0,
      "可以考虑": 0,
      "不推荐": 0,
      未评分: 0,
    };

    jobs.forEach((j) => {
      if (j.aiRecommendation) {
        counts[j.aiRecommendation] =
          (counts[j.aiRecommendation] || 0) + 1;
      } else {
        counts["未评分"]++;
      }
    });

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value }));
  }, [jobs]);

  // 城市分布 Top 5
  const locationDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((j) => {
      counts[j.location] = (counts[j.location] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border bg-card p-12 text-muted-foreground">
        暂无数据可供分析
      </div>
    );
  }

  const analyzedCount = jobs.filter((j) => j.aiScore !== null).length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 评分分布 */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">AI 评分分布</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          已分析 {analyzedCount}/{jobs.length} 个岗位
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={scoreDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="count" fill={SCORE_BAR_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 推荐等级分布 */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">推荐等级分布</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={recommendationDistribution}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {recommendationDistribution.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ||
                    "#9CA3AF"
                  }
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [`${value}个`, name]}
            />
            <Legend
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: "11px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 城市分布 */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">城市分布 Top 8</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={locationDistribution}
            layout="vertical"
            margin={{ left: -20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" fontSize={11} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              fontSize={11}
              tickLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: "12px",
              }}
            />
            <Bar
              dataKey="value"
              fill="#8B5CF6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
