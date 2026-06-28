import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, text: resume?.preferences || "" });
}

export async function PUT(request: NextRequest) {
  try {
    const { text } = await request.json();
    const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
    if (!resume) return NextResponse.json({ success: false, error: "请先上传简历" }, { status: 400 });
    await prisma.resume.update({ where: { id: resume.id }, data: { preferences: text || "" } });
    return NextResponse.json({ success: true, text });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
