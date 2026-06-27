import { z } from "zod";

/**
 * 岗位采集 Schema — Extension 发送给 Next.js API 的数据校验
 * 严格匹配 Content Script 能提取的字段
 */
export const JobIngestSchema = z.object({
  title: z.string().min(1, "岗位名称不能为空").max(255),
  company: z.string().min(1, "公司名称不能为空").max(255),
  salaryMin: z.number().int().positive().nullable().optional(),
  salaryMax: z.number().int().positive().nullable().optional(),
  location: z.string().min(1).max(100),
  jdContent: z.string().min(1, "JD 内容不能为空"),
  tags: z.array(z.string()).default([]),
  rawUrl: z.string().url().max(500),
  source: z.string().default("platform"),
});

/**
 * 批量采集请求 Schema
 */
export const JobIngestBatchSchema = z.object({
  jobs: z.array(JobIngestSchema).min(1, "至少需要 1 条岗位数据").max(50, "单次最多 50 条"),
});

export type JobIngestData = z.infer<typeof JobIngestSchema>;
export type JobIngestBatch = z.infer<typeof JobIngestBatchSchema>;
