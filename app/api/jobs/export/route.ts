import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseArr } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

/** GET /api/jobs/export — 导出 CSV */
export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { aiScore: { sort: "desc", nulls: "last" } },
  });

  const header = "标题,公司,城市,最低薪资,最高薪资,AI评分,推荐等级,匹配技能,风险提示,AI总结,来源链接\n";
  const rows = jobs.map(j => {
    const tags = parseArr(j.tags).join(";");
    const flags = parseArr(j.aiRedFlags).join(";");
    const tech = parseArr(j.aiTechMatch).join(";");
    return `"${j.title}","${j.company}","${j.location}",${j.salaryMin || ""},${j.salaryMax || ""},${j.aiScore || ""},"${j.aiRecommendation || ""}","${tech}","${flags}","${(j.aiSummary || "").replace(/"/g, "'")}","${j.rawUrl}"`;
  }).join("\n");

  const csv = "\uFEFF" + header + rows;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jobradar-export.csv"',
    },
  });
}
