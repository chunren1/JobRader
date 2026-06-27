import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  if (!resume) return NextResponse.json({ success: false, error: "No resume" }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: { id: resume.id, text: resume.rawText, structured: JSON.parse(resume.structured || "{}"), fileName: resume.fileName }
  });
}

// 粘贴文本
export async function PUT(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text || text.trim().length < 30) {
      return NextResponse.json({ success: false, error: "内容太短" }, { status: 400 });
    }
    await prisma.resume.deleteMany();
    const resume = await prisma.resume.create({
      data: { rawText: text, fileName: "手动粘贴", structured: "{}" },
    });
    return NextResponse.json({ success: true, data: { id: resume.id, text } });
  } catch (e) {
    return NextResponse.json({ success: false, error: "保存失败" }, { status: 500 });
  }
}

// 上传 PDF
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ success: false, error: "No file" }, { status: 400 });
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "只支持 PDF" }, { status: 400 });
    }

    let rawText = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdfParse(buffer);
      rawText = data.text;
    } catch (e: any) {
      console.error("PDF parse failed:", e?.message || e);
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: "PDF无法提取文字（扫描件/图片型）。请用Word打开后另存为PDF，或直接在侧边栏粘贴简历文本。"
      }, { status: 400 });
    }

    await prisma.resume.deleteMany();
    const resume = await prisma.resume.create({
      data: { rawText, fileName: file.name, structured: "{}" },
    });

    return NextResponse.json({
      success: true,
      data: { id: resume.id, text: rawText, structured: {}, fileName: file.name }
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ success: false, error: "上传失败" }, { status: 500 });
  }
}

export async function DELETE() {
  await prisma.resume.deleteMany();
  return NextResponse.json({ success: true });
}
