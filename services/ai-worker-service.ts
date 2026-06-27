import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { analyzeJob } from "./ai-job-analyzer";
import type { AiAnalysisTask, Job } from "@prisma/client";

const BATCH_SIZE = 5;
const MAX_RETRIES = 3;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 分钟锁过期时间

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
 * 简单锁机制：防止多 Worker 实例重复消费
 */
async function acquireLock(taskId: string): Promise<boolean> {
  const lockKey = `worker_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const result = await prisma.aiAnalysisTask.updateMany({
    where: {
      id: taskId,
      status: "pending",
    },
    data: {
      status: "processing",
      lockKey,
      updatedAt: new Date(),
    },
  });

  return result.count > 0;
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
    const result = await analyzeJob(job.jdContent, userProfile);
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
        aiTechMatch: result.techStackMatch,
        aiRedFlags: result.redFlags,
        aiSalaryMatch: result.salaryMatch,
        aiDimensions: result.dimensions as object,
      },
    });

    console.log(`🧠 AI analyzed: ${job.title} (score: ${result.score})`);
  }

  // 2. 更新 Job 主表 AI 字段
  await prisma.job.update({
    where: { id: job.id },
    data: {
      aiScore: analysisResult.score,
      aiSummary: analysisResult.summary,
      aiRecommendation: analysisResult.recommendation,
      aiTechMatch: analysisResult.techStackMatch,
      aiRedFlags: analysisResult.redFlags,
      aiSalaryMatch: analysisResult.salaryMatch,
      aiDimensions: analysisResult.dimensions as object,
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
export async function processAiQueue(): Promise<{
  processed: number;
  succeeded: number;
  cached: number;
  failed: number;
}> {
  console.log("🔧 AI Worker: Starting batch...");

  // 1. 获取待处理任务（跳过已达最大重试次数的）
  const tasks = await prisma.aiAnalysisTask.findMany({
    where: {
      status: "pending",
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (tasks.length === 0) {
    console.log("🔧 AI Worker: No pending tasks");
    return { processed: 0, succeeded: 0, cached: 0, failed: 0 };
  }

  console.log(`🔧 AI Worker: Processing ${tasks.length} tasks...`);

  let succeeded = 0;
  let cached = 0;
  let failed = 0;

  // 2. 逐个处理（有序处理以避免并发竞争）
  for (const task of tasks) {
    // 获取锁
    const locked = await acquireLock(task.id);
    if (!locked) {
      console.log(`⏭️ Task ${task.id} already locked by another worker`);
      continue;
    }

    try {
      const job = await prisma.job.findUnique({
        where: { id: task.jobId },
      });

      if (!job) {
        console.warn(`⚠️ Job ${task.jobId} not found for task ${task.id}`);
        await prisma.aiAnalysisTask.update({
          where: { id: task.id },
          data: { status: "failed", errorMsg: "Job not found" },
        });
        failed++;
        continue;
      }

      const result = await processSingleTask(task, job);
      succeeded++;
      if (result.cached) cached++;
    } catch (error) {
      console.error(`❌ Task ${task.id} failed:`, error);

      // 失败处理：增加重试计数
      const updatedTask = await prisma.aiAnalysisTask.findUnique({
        where: { id: task.id },
      });

      if (updatedTask && updatedTask.retryCount + 1 >= MAX_RETRIES) {
        await prisma.aiAnalysisTask.update({
          where: { id: task.id },
          data: {
            status: "failed",
            errorMsg:
              error instanceof Error
                ? error.message.substring(0, 500)
                : "Max retries exceeded",
            lockKey: null,
          },
        });
      } else {
        await prisma.aiAnalysisTask.update({
          where: { id: task.id },
          data: {
            status: "pending",
            retryCount: { increment: 1 },
            errorMsg:
              error instanceof Error
                ? error.message.substring(0, 500)
                : "Unknown error",
            lockKey: null,
          },
        });
      }

      failed++;
    }
  }

  console.log(
    `🔧 AI Worker: Done — ${succeeded} succeeded (${cached} cached), ${failed} failed`
  );

  return { processed: tasks.length, succeeded, cached, failed };
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
