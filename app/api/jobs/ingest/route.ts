import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobIngestBatchSchema } from "@/schemas/job-ingest";

export const dynamic = "force-dynamic";

/**
 * 岗位数据入库 API
 * POST /api/jobs/ingest
 * 
 * 由 Chrome Extension Content Script 调用
 * 安全机制: X-Local-Secret Header 校验
 * 去重策略: 基于 rawUrl 的 Prisma upsert
 */
export async function POST(request: NextRequest) {
  // 1. 安全校验：本地共享密钥
  const secret = request.headers.get("X-Local-Secret");
  if (secret !== process.env.LOCAL_SECRET) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid local secret" },
      { status: 401 }
    );
  }

  try {
    // 2. 解析并校验请求体
    const body = await request.json();
    const parsed = JobIngestBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { jobs: validJobs } = parsed.data;

    // 3. 事务：批量 upsert Job + 自动创建 AI 分析任务
    const result = await prisma.$transaction(async (tx) => {
      let ingested = 0;
      let updated = 0;

      for (const job of validJobs) {
        const existing = await tx.job.findUnique({
          where: { rawUrl: job.rawUrl },
        });

        const upsertedJob = await tx.job.upsert({
          where: { rawUrl: job.rawUrl },
          create: {
            title: job.title,
            company: job.company,
            salaryMin: job.salaryMin ?? null,
            salaryMax: job.salaryMax ?? null,
            location: job.location,
            jdContent: job.jdContent,
            tags: job.tags,
            rawUrl: job.rawUrl,
            source: job.source,
          },
          update: {
            title: job.title,
            company: job.company,
            salaryMin: job.salaryMin ?? null,
            salaryMax: job.salaryMax ?? null,
            location: job.location,
            jdContent: job.jdContent,
            tags: job.tags,
            // 如果 JD 内容变了，重置 AI 评分以便重新分析
            aiScore: null,
            aiSummary: null,
            aiRecommendation: null,
            aiTechMatch: [],
            aiRedFlags: [],
            aiDimensions: null,
            analyzedAt: null,
            updatedAt: new Date(),
          },
        });

        if (existing) {
          updated++;
        } else {
          ingested++;
        }

        // 为新增或 JD 变更的岗位创建 AI 分析任务
        if (!existing || existing.jdContent !== job.jdContent) {
          await tx.aiAnalysisTask.upsert({
            where: { jobId: upsertedJob.id },
            create: {
              jobId: upsertedJob.id,
              status: "pending",
              retryCount: 0,
            },
            update: {
              status: "pending",
              retryCount: 0,
              errorMsg: null,
            },
          });
        }
      }

      return { ingested, updated };
    });

    return NextResponse.json({
      success: true,
      ...result,
      total: validJobs.length,
    });
  } catch (error) {
    console.error("Ingest API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
