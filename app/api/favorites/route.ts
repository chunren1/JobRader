import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ToggleFavoriteSchema = z.object({
  jobId: z.string().min(1),
});

const UpdateFavoriteSchema = z.object({
  notes: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * 获取收藏列表
 * GET /api/favorites
 */
export async function GET() {
  try {
    const favorites = await prisma.userFavorite.findMany({
      where: { deletedAt: null },
      include: {
        job: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: favorites });
  } catch (error) {
    console.error("Favorites API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

/**
 * 切换收藏状态 (新增/软删除)
 * POST /api/favorites
 * Body: { jobId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ToggleFavoriteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { jobId } = parsed.data;

    // 检查岗位是否存在
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // 查找已有收藏（包括软删除的）
    const existing = await prisma.userFavorite.findFirst({
      where: { jobId },
    });

    if (existing) {
      if (existing.deletedAt) {
        // 恢复软删除的收藏
        const restored = await prisma.userFavorite.update({
          where: { id: existing.id },
          data: { deletedAt: null, updatedAt: new Date() },
          include: { job: true },
        });
        return NextResponse.json({
          success: true,
          action: "favorited",
          data: restored,
        });
      } else {
        // 软删除
        const deleted = await prisma.userFavorite.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(), updatedAt: new Date() },
          include: { job: true },
        });
        return NextResponse.json({
          success: true,
          action: "unfavorited",
          data: deleted,
        });
      }
    } else {
      // 新建收藏
      const created = await prisma.userFavorite.create({
        data: { jobId },
        include: { job: true },
      });
      return NextResponse.json({
        success: true,
        action: "favorited",
        data: created,
      });
    }
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}

/**
 * 更新收藏笔记和标签
 * PATCH /api/favorites
 * Body: { id: string, notes?: string, tags?: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Favorite ID is required" },
        { status: 400 }
      );
    }

    const parsed = UpdateFavoriteSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid data" },
        { status: 400 }
      );
    }

    const updated = await prisma.userFavorite.update({
      where: { id },
      data: parsed.data,
      include: { job: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update favorite error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update favorite" },
      { status: 500 }
    );
  }
}
