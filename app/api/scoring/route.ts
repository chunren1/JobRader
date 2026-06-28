import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const defaultConfig = {
  fields: [
    { id: "tech", name: "技术匹配度", type: "system", enabled: true, weight: 35, maxScore: 100 },
    { id: "salary", name: "薪资竞争力", type: "system", enabled: true, weight: 25, maxScore: 100 },
    { id: "stability", name: "公司稳定性", type: "system", enabled: true, weight: 20, maxScore: 100 },
    { id: "growth", name: "成长空间", type: "system", enabled: true, weight: 20, maxScore: 100 },
  ],
};

export async function GET() {
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  const config = resume?.scoringConfig ? JSON.parse(resume.scoringConfig) : defaultConfig;
  return NextResponse.json({ success: true, data: config });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
    if (resume) {
      await prisma.resume.update({ where: { id: resume.id }, data: { scoringConfig: JSON.stringify(body) } });
    }
    return NextResponse.json({ success: true, data: body });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
