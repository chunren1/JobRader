import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobIngestBatchSchema } from "@/schemas/job-ingest";
import { jsonArr } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

/**
 * 岗位数据入库 API
 * POST /api/jobs/ingest
 * 由 Chrome Extension Content Script 调用
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("X-Local-Secret");
  if (secret !== process.env.LOCAL_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = JobIngestBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        success: false, error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const { jobs: validJobs } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      let ingested = 0, updated = 0;

      for (const job of validJobs) {
        const existing = await tx.job.findUnique({ where: { rawUrl: job.rawUrl } });
        const tagsJson = jsonArr(job.tags);

        const upsertedJob = await tx.job.upsert({
          where: { rawUrl: job.rawUrl },
          create: {
            title: job.title, company: job.company,
            salaryMin: job.salaryMin ?? null, salaryMax: job.salaryMax ?? null,
            location: job.location, jdContent: job.jdContent,
            tags: tagsJson, rawUrl: job.rawUrl, source: job.source,
          },
          update: {
            title: job.title, company: job.company,
            salaryMin: job.salaryMin ?? null, salaryMax: job.salaryMax ?? null,
            location: job.location, jdContent: job.jdContent,
            tags: tagsJson, updatedAt: new Date(),
            // JD 变更时重置 AI 评分
            aiScore: null, aiSummary: null, aiRecommendation: null,
            aiTechMatch: jsonArr([]), aiRedFlags: jsonArr([]),
            aiDimensions: null, analyzedAt: null,
          },
        });

        if (existing) updated++; else ingested++;

        // 仅新增或 JD 变更时创建分析任务
        if (!existing || existing.jdContent !== job.jdContent) {
          await tx.aiAnalysisTask.upsert({
            where: { jobId: upsertedJob.id },
            create: { jobId: upsertedJob.id, status: "pending", retryCount: 0 },
            update: { status: "pending", retryCount: 0, errorMsg: null },
          });
        }
      }

      return { ingested, updated };
    });

    return NextResponse.json({ success: true, ...result, total: validJobs.length });
  } catch (error) {
    console.error("Ingest API error:", error);
    return NextResponse.json({
      success: false, error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
