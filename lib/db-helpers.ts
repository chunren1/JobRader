/**
 * SQLite JSON 序列化/反序列化工具
 * 
 * SQLite 不支持数组和对象类型，Prisma 会将其存为 JSON 文本
 * 这些工具在读写数据库时自动处理 JSON ↔ 原生类型的转换
 */

/** 序列化数组 → JSON 字符串 */
export const jsonArr = (arr: string[] | undefined | null): string =>
  JSON.stringify(arr ?? []);

/** 反序列化 JSON 字符串 → 数组 */
export const parseArr = (str: string | undefined | null): string[] => {
  try {
    return str ? JSON.parse(str) : [];
  } catch {
    return [];
  }
};

/** 序列化对象 → JSON 字符串 */
export const jsonObj = (obj: Record<string, unknown> | undefined | null): string =>
  JSON.stringify(obj ?? {});

/** 反序列化 JSON 字符串 → 对象 */
export const parseObj = (str: string | undefined | null): Record<string, unknown> => {
  try {
    return str ? JSON.parse(str) : {};
  } catch {
    return {};
  }
};

/** 从数据库 Job 转换 — 将 JSON 字段还原为前端期望的格式 */
export function deserializeJob(job: Record<string, unknown>): Record<string, unknown> {
  return {
    ...job,
    tags: parseArr(job.tags as string),
    aiTechMatch: parseArr(job.aiTechMatch as string),
    aiRedFlags: parseArr(job.aiRedFlags as string),
    aiDimensions: parseObj(job.aiDimensions as string),
  };
}
