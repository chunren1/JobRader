import { z } from "zod";

/**
 * 多维度评分 Schema
 */
export const JobDimensionsSchema = z.object({
  tech: z.number().min(0).max(100).describe("技术匹配度"),
  salary: z.number().min(0).max(100).describe("薪资竞争力"),
  stability: z.number().min(0).max(100).describe("公司稳定性"),
  growth: z.number().min(0).max(100).describe("成长空间"),
});

/**
 * AI 岗位分析结果
 * 这是 AI 结构化输出的核心 Schema
 */
export const JobAnalysisSchema = z.object({
  score: z.number().min(0).max(100).describe("综合匹配度评分 (0-100)"),
  salaryMatch: z.enum(["低于预期", "符合预期", "高于预期"]).describe("薪资与用户预期的对比"),
  techStackMatch: z.array(z.string()).describe("匹配用户技能的技术栈列表"),
  redFlags: z.array(z.string()).describe("潜在风险点，如：外包、加班严重、公司规模小等"),
  summary: z.string().max(200).describe("一句话岗位亮点总结，突出关键信息"),
  recommendation: z.enum(["强烈推荐", "可以考虑", "不推荐"]).describe("最终推荐结论"),
  dimensions: JobDimensionsSchema.describe("技术/薪资/稳定性/成长 四维度评分"),
});

export type JobDimensions = z.infer<typeof JobDimensionsSchema>;
export type JobAnalysisResult = z.infer<typeof JobAnalysisSchema>;
