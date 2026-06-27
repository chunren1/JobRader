import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { deserializeJob } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

/**
 * 获取岗位列表 API (Dashboard 数据源)
 * GET /api/jobs?location=北京&minScore=60&recommendation=强烈推荐&search=前端&page=1&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const location = searchParams.get("location");
    const minScore = searchParams.get("minScore");
    const recommendation = searchParams.get("recommendation");
    const search = searchParams.get("search");

    const where: Prisma.JobWhereInput = {};
    if (location) where.location = location;
    if (minScore) where.aiScore = { gte: parseInt(minScore) };
    if (recommendation) where.aiRecommendation = recommendation;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { company: { contains: search } },
        { jdContent: { contains: search } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { favorites: { where: { deletedAt: null } } },
        orderBy: [{ aiScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    const locations = await prisma.job.findMany({
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
    });

    // SQLite: 反序列化 JSON 字段 → 数组/对象
    const data = jobs.map((j) => deserializeJob(j as unknown as Record<string, unknown>));

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { locations: locations.map((l) => l.location) },
    });
  } catch (error) {
    console.error("Jobs API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch jobs" }, { status: 500 });
  }
}
