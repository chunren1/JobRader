import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PUT /api/resume/structured — 更新简历结构化数据，并触发重评分
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
    if (!resume) return NextResponse.json({ success: false, error: "No resume" }, { status: 404 });

    // 更新结构化数据
    await prisma.resume.update({
      where: { id: resume.id },
      data: { structured: JSON.stringify(body) },
    });

    // 重置所有岗位的 AI 评分，触发重分析
    await prisma.job.updateMany({
      where: { aiScore: { not: null } },
      data: { aiScore: null, aiSummary: null, aiRecommendation: null, aiTechMatch: "[]", aiRedFlags: "[]", aiDimensions: null, analyzedAt: null },
    });

    // 创建新的分析任务
    const allJobs = await prisma.job.findMany({ select: { id: true } });
    for (const job of allJobs) {
      await prisma.aiAnalysisTask.upsert({
        where: { jobId: job.id },
        create: { jobId: job.id, status: "pending", retryCount: 0 },
        update: { status: "pending", retryCount: 0, errorMsg: null },
      });
    }

    return NextResponse.json({ success: true, message: `已保存，${allJobs.length} 个岗位待重评分` });
  } catch (e: any) {
    console.error("Update structured error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
