import { NextRequest, NextResponse } from "next/server";
import { processAiQueue, releaseStaleLocks } from "@/services/ai-worker-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby 最大 60s, Pro 可设 300s

/**
 * AI 分析批处理 Worker (Vercel Cron 触发)
 * GET /api/workers/ai-analyze
 * 
 * 安全机制: Authorization Bearer Token 校验
 * 调度: Vercel Cron 每 10 分钟触发一次
 */
export async function GET(request: NextRequest) {
  // 校验 Cron Secret
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // 先释放过期锁
    await releaseStaleLocks();

    // 执行批处理
    const result = await processAiQueue();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ AI Worker crashed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Worker crashed",
      },
      { status: 500 }
    );
  }
}

/**
 * POST 也支持 — 方便手动触发调试
 */
export async function POST(request: NextRequest) {
  // 开发环境允许手动触发
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await releaseStaleLocks();
    const result = await processAiQueue();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Worker error:", error);
    return NextResponse.json(
      { success: false, error: "Worker crashed" },
      { status: 500 }
    );
  }
}
