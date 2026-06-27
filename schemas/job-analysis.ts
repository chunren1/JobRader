import { z } from "zod";

export const SkillMatchItemSchema = z.object({
  skill: z.string(),
  level: z.string(),
  match: z.boolean(),
});

export const JobDimensionsSchema = z.object({
  tech: z.number().min(0).max(100),
  salary: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  growth: z.number().min(0).max(100),
});

export const JobAnalysisSchema = z.object({
  score: z.number().min(0).max(100).describe("综合匹配度评分"),
  salaryMatch: z.enum(["低于预期", "符合预期", "高于预期"]),
  techStackMatch: z.array(z.string()).describe("匹配的技术栈"),
  redFlags: z.array(z.string()).describe("风险提示"),
  summary: z.string().max(300).describe("亮点总结"),
  recommendation: z.enum(["强烈推荐", "可以考虑", "不推荐"]),
  dimensions: JobDimensionsSchema.describe("四维度评分"),
  skillMatrix: z.array(SkillMatchItemSchema).optional().describe("逐项技能匹配矩阵"),
  experienceFit: z.array(z.string()).optional().describe("经验契合点"),
  gaps: z.array(z.string()).optional().describe("能力差距"),
});

export type SkillMatchItem = z.infer<typeof SkillMatchItemSchema>;
export type JobDimensions = z.infer<typeof JobDimensionsSchema>;
export type JobAnalysisResult = z.infer<typeof JobAnalysisSchema>;
