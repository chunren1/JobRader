import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名，自动处理冲突
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化薪资范围显示
 */
export function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "薪资面议";
  if (min && max) return `${(min / 1000).toFixed(0)}K-${(max / 1000).toFixed(0)}K`;
  if (min) return `${(min / 1000).toFixed(0)}K起`;
  return `最高${(max! / 1000).toFixed(0)}K`;
}

/**
 * 格式化时间
 */
export function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return d.toLocaleDateString("zh-CN");
}

/**
 * AI 评分对应的颜色和标签
 */
export function getScoreInfo(score: number | null): {
  color: string;
  bgColor: string;
  label: string;
} {
  if (score === null) {
    return { color: "#9CA3AF", bgColor: "#F3F4F6", label: "未评分" };
  }
  if (score >= 80) {
    return { color: "#059669", bgColor: "#D1FAE5", label: "高分" };
  }
  if (score >= 60) {
    return { color: "#D97706", bgColor: "#FEF3C7", label: "中等" };
  }
  return { color: "#DC2626", bgColor: "#FEE2E2", label: "低分" };
}

/**
 * 推荐等级对应颜色
 */
export function getRecommendationColor(level: string | null): string {
  switch (level) {
    case "强烈推荐":
      return "bg-green-100 text-green-800 border-green-300";
    case "可以考虑":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "不推荐":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-gray-100 text-gray-600 border-gray-300";
  }
}
