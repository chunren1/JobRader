import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonArr } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

// CORS 预检
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Local-Secret",
    },
  });
}

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
    const rawJobs = body.jobs;

    if (!Array.isArray(rawJobs) || rawJobs.length === 0) {
      return NextResponse.json({ success: false, error: "jobs array required" }, { status: 400 });
    }

    // 宽松校验：过滤掉空数据，补全缺失字段
    const validJobs = rawJobs
      .filter(function(j: any) { return j && j.title && j.rawUrl; })
      .map(function(j: any) {
        return {
          title: String(j.title).substring(0, 255),
          company: String(j.company || "未知").substring(0, 255),
          salaryMin: j.salaryMin != null ? Math.abs(Number(j.salaryMin)) : null,
          salaryMax: j.salaryMax != null ? Math.abs(Number(j.salaryMax)) : null,
          location: String(j.location || "未知").substring(0, 100),
          jdContent: String(j.jdContent || j.title).substring(0, 5000),
          tags: Array.isArray(j.tags) ? j.tags.slice(0, 20) : [],
          rawUrl: String(j.rawUrl).substring(0, 500),
          source: String(j.source || "platform"),
        };
      });

    if (validJobs.length === 0) {
      return NextResponse.json({ success: false, error: "No valid jobs after filtering" }, { status: 400 });
    }

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

    return NextResponse.json({ success: true, ingested: result.ingested, updated: result.updated, total: validJobs.length });
  } catch (error) {
    console.error("Ingest API error:", error);
    return NextResponse.json({
      success: false, error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
