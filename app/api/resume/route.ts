import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 获取当前简历
 */
export async function GET() {
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  if (!resume) {
    return NextResponse.json({ success: false, error: "No resume" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: { id: resume.id, text: resume.rawText, structured: JSON.parse(resume.structured || "{}"), fileName: resume.fileName }
  });
}

/**
 * 上传简历 PDF
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "只支持 PDF 格式" }, { status: 400 });
    }

    // 解析 PDF
    let rawText = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdfParse(buffer);
      rawText = data.text;
    } catch (e: any) {
      console.error("PDF parse failed, trying OCR...", e?.message || e);
    }

    // 文字提取失败，尝试 OCR
    if (!rawText || rawText.trim().length < 50) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdf2img = await import("pdf-to-img");
        const Tesseract = (await import("tesseract.js")).default;
        // 只 OCR 前 3 页（省时间）
        let ocrText = "";
        let pageCount = 0;
        const doc = await pdf2img.pdf(buffer);
        for await (const page of doc) {
          if (pageCount >= 3) break;
          const result = await Tesseract.recognize(page, "chi_sim+eng");
          ocrText += result.data.text + "\n";
          pageCount++;
        }
        if (ocrText.trim().length > 50) rawText = ocrText.trim();
      } catch (ocrErr: any) {
        console.error("OCR also failed:", ocrErr?.message || ocrErr);
      }
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: "PDF无法提取文字。请确认PDF为文字版或用Word导出。" + (rawText ? "(" + rawText.length + "字符)" : "")
      }, { status: 400 });
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json({ success: false, error: "简历内容太短(" + (rawText?.length || 0) + "字符)，请检查PDF" }, { status: 400 });
    }

    // 删除旧简历，只保留最新一份
    await prisma.resume.deleteMany();
    const resume = await prisma.resume.create({
      data: { rawText, fileName: file.name, structured: "{}" },
    });

    // 用 AI 从简历中提取结构化信息
    let structured = {};
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const truncated = rawText.substring(0, 3000);
        const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V4-Flash",
            messages: [
              { role: "system", content: `你是专业的简历解析专家。从简历中提取结构化信息，只输出纯JSON。格式:
{"name":"姓名","skills":["技能1","技能2"],"experience":[{"company":"公司","role":"岗位","duration":"时间段","achievements":["成就1"]}],"education":"学历","summary":"一句话总结"}` },
              { role: "user", content: truncated },
            ],
            temperature: 0.1, max_tokens: 1500,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          const json = content.match(/\{[\s\S]*\}/);
          if (json) structured = JSON.parse(json[0]);
        }
      } catch (e) { console.warn("AI resume extraction failed:", e); }
    }

    // 更新结构化数据
    await prisma.resume.update({
      where: { id: resume.id },
      data: { structured: JSON.stringify(structured) },
    });

    return NextResponse.json({
      success: true,
      data: { id: resume.id, text: rawText, structured, fileName: file.name }
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json({ success: false, error: "上传失败" }, { status: 500 });
  }
}

/**
 * 删除简历
 */
export async function DELETE() {
  await prisma.resume.deleteMany();
  return NextResponse.json({ success: true });
}
