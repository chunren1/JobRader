import { JobAnalysisSchema, type JobAnalysisResult } from "@/schemas/job-analysis";

function truncateJD(jdContent: string, maxChars = 3000): string {
  if (jdContent.length <= maxChars) return jdContent;
  return jdContent.substring(0, maxChars) + "...(已截断)";
}

function buildSystemPrompt(resumeText: string, expectedSalary: string, structuredResume?: Record<string, unknown>, prefsText?: string): string {
  const struct = structuredResume && Object.keys(structuredResume).length > 1
    ? `\n### 简历结构化数据\n- 姓名: ${structuredResume.name || "未知"}\n- 求职方向: ${structuredResume.title || "未知"}\n- 工作年限: ${structuredResume.yearsOfExp || "未知"}\n- 学历: ${(structuredResume.education as any)?.degree || "未知"} ${(structuredResume.education as any)?.major || ""}\n- 技能: ${(structuredResume.skills as string[])?.join(", ") || "未知"}\n- 工作经历: ${(structuredResume.experience as any[])?.map((e: any) => `${e.company} ${e.role} (${e.duration})`).join("; ") || "无"}\n- 项目经验: ${(structuredResume.projects as any[])?.map((p: any) => p.name).join(", ") || "无"}\n- 核心优势: ${structuredResume.summary || "无"}`
    : "";

  const prefsSection = prefsText && prefsText.trim()
    ? `\n## 用户额外要求（必须严格参照）\n${prefsText}`
    : "";

  return `你是顶级猎头公司的职业匹配分析师。你需要深度对比求职者简历和目标岗位JD，输出结构化的匹配分析报告。

## 求职者简历
${resumeText || "未上传简历"}${struct}${prefsSection}

## 期望薪资
${expectedSalary || "未设置"}

## 分析要求

### 1. 技能匹配分析 (techMatch)
- 逐条列出JD要求的关键技能
- 逐一对比简历中是否有对应技能
- 标注每项技能的水平：精通/熟练/了解/缺失
- 给出技能匹配矩阵

### 2. 经验契合点 (experienceFit)
- JD要求的项目经验 vs 简历中相关项目
- 行业领域匹配度（如有）
- 技术栈重合分析
- 职级匹配度

### 3. 能力差距 (gaps)  
- 明确列出缺失的关键技能
- 经验年限缺口
- 学历/证书要求差距

### 4. 风险提示 (redFlags)
- 频繁跳槽
- 技术栈过时
- 行业不匹配
- 外包/驻场等不良信号
- 薪资倒挂风险

### 5. 综合建议 (recommendation)
- 基于上述分析给出：强烈推荐/可以考虑/不推荐
- 一句话总结
- 如果推荐，说明核心优势
- 如果不推荐，说明关键原因

## Few-Shot 示例

JD: "字节跳动高级前端，React/TS/Next.js，5年经验，40-65K"
简历: "5年React+TS经验，主导过大型B端项目，熟悉Next.js SSR，Node.js中间层开发"
输出:
{"score":92,"salaryMatch":"符合预期","techStackMatch":["React","TypeScript","Next.js","Node.js"],"redFlags":["工作强度可能较大"],"summary":"技术栈高度匹配，项目经验对口，唯一风险是大厂工作强度","recommendation":"强烈推荐","dimensions":{"tech":95,"salary":88,"stability":85,"growth":90},"skillMatrix":[{"skill":"React","level":"精通","match":true},{"skill":"TypeScript","level":"精通","match":true},{"skill":"Next.js","level":"熟练","match":true}],"experienceFit":["有大型B端项目经验","SSR实战经验丰富"],"gaps":["无重大能力差距"]}

## 输出格式
只输出纯JSON，不要markdown标记或额外文字。` + "\n\n" + JSON.stringify({
  score: 85, salaryMatch: "符合预期",
  techStackMatch: ["技能1"], redFlags: ["风险1"],
  summary: "一句话亮点总结", recommendation: "可以考虑",
  dimensions: { tech: 85, salary: 80, stability: 70, growth: 85 },
  skillMatrix: [{ skill: "技能", level: "精通", match: true }],
  experienceFit: ["经验匹配点"], gaps: ["能力差距点"]
}, null, 2);
}

function truncateResume(text: string): string {
  if (text.length <= 2000) return text;
  return text.substring(0, 2000) + "...(已截断)";
}

export async function analyzeJob(
  jdContent: string,
  userProfile: { resumeSummary: string; preferences: string; expectedSalary: string },
  resumeText?: string,
  structuredResume?: Record<string, unknown>,
  prefsText?: string
): Promise<JobAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.warn("No API key configured"); return null; }

  const model = process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V4-Flash";
  const baseUrl = process.env.AI_BASE_URL || "https://api.siliconflow.cn/v1";
  const truncatedJD = truncateJD(jdContent);

  // 优先用上传的简历，否则用环境变量里的摘要
  const resumeForPrompt = resumeText
    ? truncateResume(resumeText)
    : `【用户简况】${userProfile.resumeSummary}；偏好：${userProfile.preferences}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(resumeForPrompt, userProfile.expectedSalary, structuredResume, prefsText) },
          { role: "user", content: `请分析以下职位：\n\n${truncatedJD}` },
        ],
        temperature: 0.3, max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`AI API error ${response.status}: ${errBody.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) { console.error("Empty AI response"); return null; }

    let parsed;
    try { parsed = JSON.parse(content); }
    catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); }
        catch { console.error("Failed to repair JSON"); return null; }
      } else { return null; }
    }

    const validated = JobAnalysisSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("Zod validation failed:", JSON.stringify(validated.error.flatten().fieldErrors));
      return null;
    }

    return validated.data;
  } catch (error) {
    console.error("AI analysis error:", error);
    return null;
  }
}
