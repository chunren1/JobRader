import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST /api/workers/reanalyze — 重评单个岗位 */
export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ success: false, error: "jobId required" }, { status: 400 });

    // 清空评分
    await prisma.job.update({
      where: { id: jobId },
      data: { aiScore: null, aiSummary: null, aiRecommendation: null, aiTechMatch: "[]", aiRedFlags: "[]", aiDimensions: null, analyzedAt: null },
    });

    // 创建任务
    await prisma.aiAnalysisTask.upsert({
      where: { jobId },
      create: { jobId, status: "pending", retryCount: 0 },
      update: { status: "pending", retryCount: 0, errorMsg: null },
    });

    // 触发分析
    fetch("http://localhost:3000/api/workers/ai-analyze", { method: "POST" }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
