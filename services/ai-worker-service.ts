import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { analyzeJob } from "./ai-job-analyzer";
import { jsonArr, jsonObj } from "@/lib/db-helpers";
import type { AiAnalysisTask, Job } from "@prisma/client";

const BATCH_SIZE = 5;
const CONCURRENCY = 3; // 并行处理数
const MAX_RETRIES = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000;

/**
 * 计算 JD 文本的 SHA-256 哈希
 */
function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * 获取用户画像（从环境变量加载）
 */
function getUserProfile() {
  return {
    resumeSummary:
      process.env.USER_RESUME_SUMMARY || "全栈开发工程师",
    preferences:
      process.env.USER_PREFERENCES || "远程办公、AI方向",
    expectedSalary:
      process.env.USER_EXPECTED_SALARY || "25-45K",
  };
}

/**
 * 处理单个 AI 分析任务（含缓存逻辑）
 */
async function processSingleTask(
  task: AiAnalysisTask,
  job: Job
): Promise<{ success: boolean; cached: boolean }> {
  const userProfile = getUserProfile();
  const jdHash = hashText(job.jdContent);

  // 读取简历（含结构化数据）
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  const resumeText = resume?.rawText || undefined;
  const structuredResume = resume?.structured ? JSON.parse(resume.structured) : undefined;

  // 1. 尝试命中缓存
  const cachedResult = await prisma.aiAnalysisCache.findUnique({
    where: { jdHash },
  });

  let analysisResult;
  let wasCached = false;

  if (cachedResult) {
    // ✅ 缓存命中：复用结果
    analysisResult = {
      score: cachedResult.aiScore,
      summary: cachedResult.aiSummary,
      recommendation: cachedResult.aiRecommendation as "强烈推荐" | "可以考虑" | "不推荐",
      techStackMatch: cachedResult.aiTechMatch,
      redFlags: cachedResult.aiRedFlags,
      salaryMatch: cachedResult.aiSalaryMatch as "低于预期" | "符合预期" | "高于预期",
      dimensions: cachedResult.aiDimensions as Record<string, number>,
    };

    await prisma.aiAnalysisCache.update({
      where: { jdHash },
      data: { hitCount: { increment: 1 } },
    });

    wasCached = true;
    console.log(`♻️ Cache hit: ${job.title} (hits: ${cachedResult.hitCount + 1})`);
  } else {
    // ❌ 未命中缓存：调用 AI
    const result = await analyzeJob(job.jdContent, userProfile, resumeText, structuredResume);
    if (!result) {
      throw new Error("AI analysis failed — returned null");
    }

    analysisResult = result;

    // 写入缓存
    await prisma.aiAnalysisCache.create({
      data: {
        jdHash,
        aiScore: result.score,
        aiSummary: result.summary,
        aiRecommendation: result.recommendation,
        aiTechMatch: jsonArr(result.techStackMatch),
        aiRedFlags: jsonArr(result.redFlags),
        aiSalaryMatch: result.salaryMatch,
        aiDimensions: jsonObj(result.dimensions as Record<string, unknown>),
      },
    });

    console.log(`🧠 AI analyzed: ${job.title} (score: ${result.score})`);
  }

  // 2. 更新 Job 主表 AI 字段 (SQLite: 数组/对象序列化为 JSON 字符串)
  await prisma.job.update({
    where: { id: job.id },
    data: {
      aiScore: analysisResult.score,
      aiSummary: analysisResult.summary,
      aiRecommendation: analysisResult.recommendation,
      aiTechMatch: jsonArr(analysisResult.techStackMatch),
      aiRedFlags: jsonArr(analysisResult.redFlags),
      aiSalaryMatch: analysisResult.salaryMatch,
      aiDimensions: jsonObj(analysisResult.dimensions as Record<string, unknown>),
      analyzedAt: new Date(),
    },
  });

  // 3. 标记任务完成
  await prisma.aiAnalysisTask.update({
    where: { id: task.id },
    data: { status: "completed", lockKey: null, updatedAt: new Date() },
  });

  return { success: true, cached: wasCached };
}

/**
 * AI Worker 核心：批量消费分析任务
 * 
 * 流程：获取 pending 任务 → 加锁 → 并行处理 → 成功/失败处理
 */
async function processOneTask(task: AiAnalysisTask): Promise<{ success: boolean; cached: boolean }> {
  const job = await prisma.job.findUnique({ where: { id: task.jobId } });
  if (!job) {
    await prisma.aiAnalysisTask.update({ where: { id: task.id }, data: { status: "failed", errorMsg: "Job not found" } });
    return { success: false, cached: false };
  }
  try {
    const result = await processSingleTask(task, job);
    return { success: true, cached: result.cached };
  } catch (error) {
    const updatedTask = await prisma.aiAnalysisTask.findUnique({ where: { id: task.id } });
    if (updatedTask && updatedTask.retryCount + 1 >= MAX_RETRIES) {
      await prisma.aiAnalysisTask.update({ where: { id: task.id }, data: { status: "failed", errorMsg: error instanceof Error ? error.message.substring(0, 500) : "Max retries exceeded", lockKey: null } });
    } else {
      await prisma.aiAnalysisTask.update({ where: { id: task.id }, data: { status: "pending", retryCount: { increment: 1 }, errorMsg: error instanceof Error ? error.message.substring(0, 500) : "Unknown error", lockKey: null } });
    }
    return { success: false, cached: false };
  }
}

export async function processAiQueue(): Promise<{
  processed: number;
  succeeded: number;
  cached: number;
  failed: number;
}> {
  let totalProcessed = 0, totalSucceeded = 0, totalCached = 0, totalFailed = 0;

  while (true) {
    // 先清除卡住的 processing 锁
    await releaseStaleLocks();

    const tasks = await prisma.aiAnalysisTask.findMany({
      where: { status: "pending", retryCount: { lt: MAX_RETRIES } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    if (tasks.length === 0) {
      console.log(`🔧 AI Worker: All done — ${totalSucceeded} succeeded (${totalCached} cached)`);
      break;
    }

    // 标记为 processing
    await prisma.aiAnalysisTask.updateMany({
      where: { id: { in: tasks.map(t => t.id) } },
      data: { status: "processing" },
    });

    // 并行处理
    let batch = [];
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const chunk = tasks.slice(i, i + CONCURRENCY);
      batch = [];
      for (const t of chunk) batch.push(processOneTask(t));
      const results = await Promise.allSettled(batch);
      results.forEach((r, j) => {
        if (r.status === "fulfilled" && r.value.success) {
          totalSucceeded++;
          if (r.value.cached) totalCached++;
        } else {
          totalFailed++;
        }
      });
      totalProcessed += chunk.length;
    }

    console.log(`🔧 AI Worker: Batch done — ${totalSucceeded} ok, ${totalFailed} fail`);
  }

  return { processed: totalProcessed, succeeded: totalSucceeded, cached: totalCached, failed: totalFailed };
}

/**
 * 释放过期锁（清理死锁任务）
 * 可在 Worker 启动时调用
 */
export async function releaseStaleLocks(): Promise<number> {
  const staleTime = new Date(Date.now() - LOCK_DURATION_MS);

  const result = await prisma.aiAnalysisTask.updateMany({
    where: {
      status: "processing",
      updatedAt: { lt: staleTime },
    },
    data: {
      status: "pending",
      retryCount: { increment: 1 },
      lockKey: null,
      errorMsg: "Lock expired — task reset",
    },
  });

  if (result.count > 0) {
    console.log(`🔓 Released ${result.count} stale locks`);
  }

  return result.count;
}
