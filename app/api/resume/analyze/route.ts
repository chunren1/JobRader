import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/resume/analyze — 用 AI 提取简历结构化信息
 */
export async function GET() {
  const resume = await prisma.resume.findFirst({ orderBy: { createdAt: "desc" } });
  if (!resume) return NextResponse.json({ success: false, error: "No resume" }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: "API key not set" }, { status: 500 });

  const text = resume.rawText.substring(0, 4000);

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V4-Flash",
        messages: [
          {
            role: "system",
            content: `你是顶级简历解析专家。从简历中提取结构化JSON。只输出JSON，不要markdown。
{
  "name": "姓名",
  "title": "当前职位/求职方向",
  "email": "邮箱",
  "phone": "电话",
  "city": "城市",
  "yearsOfExp": "工作年限",
  "education": {"school": "学校", "degree": "学历", "major": "专业", "year": "毕业年份"},
  "skills": ["技能1", "技能2"],
  "experience": [{"company": "公司", "role": "岗位", "duration": "时间段", "summary": "一句话职责"}],
  "projects": [{"name": "项目名", "role": "角色", "tech": ["技术"], "summary": "简述"}],
  "summary": "一段话总结求职者核心优势"
}`
          },
          { role: "user", content: text },
        ],
        temperature: 0.1, max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI resume extract failed:", response.status, err.substring(0, 200));
      return NextResponse.json({ success: false, error: `AI 调用失败(${response.status})` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ success: false, error: "AI 返回了非 JSON 内容" }, { status: 500 });

    const parsed = JSON.parse(m[0]);

    // 存回数据库
    await prisma.resume.update({
      where: { id: resume.id },
      data: { structured: JSON.stringify(parsed) },
    });

    return NextResponse.json({ success: true, data: parsed });
  } catch (e: any) {
    console.error("Resume analyze error:", e.message);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
