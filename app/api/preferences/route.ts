import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET */
export async function GET() {
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data: JSON.parse(resume?.preferences || "{}") });
}

/** PUT — 保存偏好 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
    if (!resume) return NextResponse.json({ success: false, error: "请先上传简历" }, { status: 400 });

    await prisma.resume.update({
      where: { id: resume.id },
      data: { preferences: JSON.stringify(body) },
    });

    return NextResponse.json({ success: true, data: body });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
