import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { jsonArr, parseArr, deserializeJob } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

const ToggleFavoriteSchema = z.object({ jobId: z.string().min(1) });
const UpdateFavoriteSchema = z.object({
  notes: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const favorites = await prisma.userFavorite.findMany({
      where: { deletedAt: null },
      include: { job: true },
      orderBy: { createdAt: "desc" },
    });

    const data = favorites.map((f) => ({
      ...f,
      tags: parseArr(f.tags),
      job: deserializeJob(f.job as unknown as Record<string, unknown>),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Favorites API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ToggleFavoriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const { jobId } = parsed.data;
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    const existing = await prisma.userFavorite.findFirst({ where: { jobId } });

    if (existing) {
      if (existing.deletedAt) {
        const restored = await prisma.userFavorite.update({
          where: { id: existing.id },
          data: { deletedAt: null, updatedAt: new Date() },
          include: { job: true },
        });
        return NextResponse.json({
          success: true, action: "favorited",
          data: { ...restored, tags: parseArr(restored.tags), job: deserializeJob(restored.job as unknown as Record<string, unknown>) },
        });
      } else {
        await prisma.userFavorite.update({
          where: { id: existing.id },
          data: { deletedAt: new Date(), updatedAt: new Date() },
        });
        return NextResponse.json({ success: true, action: "unfavorited" });
      }
    } else {
      const created = await prisma.userFavorite.create({
        data: { jobId },
        include: { job: true },
      });
      return NextResponse.json({
        success: true, action: "favorited",
        data: { ...created, tags: parseArr(created.tags), job: deserializeJob(created.job as unknown as Record<string, unknown>) },
      });
    }
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return NextResponse.json({ success: false, error: "Failed to toggle favorite" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "Favorite ID is required" }, { status: 400 });
    }

    const parsed = UpdateFavoriteSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid data" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.tags !== undefined) updateData.tags = jsonArr(parsed.data.tags);

    const updated = await prisma.userFavorite.update({
      where: { id },
      data: updateData,
      include: { job: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...updated, tags: parseArr(updated.tags), job: deserializeJob(updated.job as unknown as Record<string, unknown>) },
    });
  } catch (error) {
    console.error("Update favorite error:", error);
    return NextResponse.json({ success: false, error: "Failed to update favorite" }, { status: 500 });
  }
}
