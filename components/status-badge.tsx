import { cn } from "@/lib/utils";
import { getScoreInfo, getRecommendationColor } from "@/lib/utils";

/**
 * AI 评分徽章
 */
export function ScoreBadge({ score }: { score: number | null }) {
  const info = getScoreInfo(score);

  if (score === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        )}
        style={{ color: info.color, backgroundColor: info.bgColor }}
      >
        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
        分析中
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ color: info.color, backgroundColor: info.bgColor }}
    >
      {score}分
    </span>
  );
}

/**
 * 推荐等级徽章
 */
export function RecommendationBadge({
  level,
}: {
  level: string | null;
}) {
  if (!level) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        getRecommendationColor(level)
      )}
    >
      {level}
    </span>
  );
}

/**
 * 薪资匹配徽章
 */
export function SalaryMatchBadge({
  match,
}: {
  match: string | null;
}) {
  if (!match) return null;

  const colors: Record<string, string> = {
    "高于预期": "bg-green-100 text-green-700 border-green-200",
    "符合预期": "bg-blue-100 text-blue-700 border-blue-200",
    "低于预期": "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        colors[match] || "bg-gray-100 text-gray-600 border-gray-200"
      )}
    >
      {match}
    </span>
  );
}
