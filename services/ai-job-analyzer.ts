import { JobAnalysisSchema, type JobAnalysisResult } from "@/schemas/job-analysis";

/**
 * AI 评分 System Prompt 模板
 * 
 * 用户画像通过参数注入，避免敏感信息硬编码
 */
function buildSystemPrompt(userProfile: {
  resumeSummary: string;
  preferences: string;
  expectedSalary: string;
}): string {
  return `你是一位资深的职业规划顾问和招聘专家。你的任务是分析职位描述(JD)，并根据用户背景给出客观的量化评分。

## 用户背景
- 经验：${userProfile.resumeSummary}
- 偏好：${userProfile.preferences}
- 期望薪资范围：${userProfile.expectedSalary}

## 评分标准
1. 技术匹配度 (tech): 用户技能与JD要求的技术栈重合度
2. 薪资竞争力 (salary): JD薪资与用户预期的对比
3. 公司稳定性 (stability): 根据公司规模、行业地位、招聘文案质量判断
4. 成长空间 (growth): 岗位对职业发展的价值

## 红旗规则
- 出现"外包"、"驻场"、"派遣"字样 -> 标记外包风险
- 出现"996"、"大小周"、"弹性工作" -> 标记加班风险
- 出现"抗压"、"高强度" -> 标记压力风险
- 公司规模小/创业公司 -> 标记稳定性风险
- 薪资明显低于用户预期 -> 标记薪资风险
- 要求非核心技能过多 -> 标记技能不匹配

## Few-Shot 示例

### 示例1: 好岗位
JD: "字节跳动招聘高级前端工程师，负责抖音电商核心业务，要求React/TypeScript/Next.js，薪资40-65K·16薪"
输出: { score: 92, salaryMatch: "高于预期", techStackMatch: ["React","TypeScript","Next.js"], redFlags: ["工作强度可能较大"], summary: "顶级大厂核心业务，技术栈高度匹配", recommendation: "强烈推荐", dimensions: { tech: 95, salary: 95, stability: 85, growth: 90 } }

### 示例2: 差岗位
JD: "急招Java开发驻场百度，要求接受996和长期出差，薪资15-20K"
输出: { score: 20, salaryMatch: "低于预期", techStackMatch: [], redFlags: ["驻场岗位","996加班","薪资偏低"], summary: "外包驻场岗，薪资低且加班严重", recommendation: "不推荐", dimensions: { tech: 10, salary: 15, stability: 20, growth: 10 } }

## 输出要求
你只能输出一行纯 JSON，不要有任何解释、markdown 标记或额外文字。格式如下：
{"score": 85, "salaryMatch": "符合预期", "techStackMatch": ["React"], "redFlags": [], "summary": "一句话总结", "recommendation": "强烈推荐", "dimensions": {"tech": 85, "salary": 80, "stability": 70, "growth": 90}}`;
}

/**
 * 智能截断 JD 内容，保留关键信息
 * 策略：优先保留开头描述和要求部分，中间大段描述适当截断
 */
function truncateJD(jdContent: string, maxChars: number = 3000): string {
  if (jdContent.length <= maxChars) return jdContent;

  const sections = jdContent.split(/\n\n|\r\n\r\n/);
  if (sections.length <= 1) {
    return jdContent.substring(0, maxChars) + "...(内容已截断)";
  }

  // 保留第一段和最后一段（通常包含职位描述和要求）
  const first = sections[0];
  const last = sections[sections.length - 1];
  const middleMax = maxChars - first.length - last.length - 50;

  if (middleMax > 0) {
    const middle = sections
      .slice(1, -1)
      .join("\n\n")
      .substring(0, middleMax);
    return `${first}\n\n${middle}\n\n...(中间部分已截断)\n\n${last}`;
  }

  return jdContent.substring(0, maxChars) + "...(内容已截断)";
}

/**
 * AI 岗位分析服务
 * 
 * @param jdContent - 岗位描述原文
 * @param userProfile - 用户简历/偏好摘要
 * @returns 结构化分析结果，失败返回 null
 */
export async function analyzeJob(
  jdContent: string,
  userProfile: {
    resumeSummary: string;
    preferences: string;
    expectedSalary: string;
  }
): Promise<JobAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ OPENAI_API_KEY not configured, skipping AI analysis");
    return null;
  }

  const model = process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V4-Flash";
  const baseUrl = process.env.AI_BASE_URL || "https://api.siliconflow.cn/v1";
  const truncatedJD = truncateJD(jdContent);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(userProfile) },
          {
            role: "user",
            content: `请分析以下职位描述：\n\n${truncatedJD}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        // SiliconFlow DeepSeek 不支持 json_object，用 prompt 约束输出来替代
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`AI API error ${response.status}: ${errBody.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("AI returned empty response");
      return null;
    }

    // 解析 JSON 输出
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("AI returned invalid JSON, attempting repair...");
      // 尝试从文本中提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.error("Failed to repair JSON");
          return null;
        }
      } else {
        return null;
      }
    }

    // 使用 Zod 校验结构化输出
    const validated = JobAnalysisSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("AI Zod validation failed:", JSON.stringify(validated.error.flatten().fieldErrors));
      console.error("Raw AI output:", content.substring(0, 300));
      return null;
    }

    return validated.data;
  } catch (error) {
    console.error("AI analysis error:", error);
    return null;
  }
}
