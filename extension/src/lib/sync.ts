/**
 * Extension ↔ Next.js 通信模块
 * 
 * 将提取的岗位数据发送到本地 Next.js 服务
 * 包含重试机制和错误日志
 */

const NEXTJS_BASE_URL = "http://localhost:3000";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * 岗位采集数据类型（与后端 Zod Schema 保持一致）
 */
export interface JobIngestData {
  title: string;
  company: string;
  salaryMin: number | null;
  salaryMax: number | null;
  location: string;
  jdContent: string;
  tags: string[];
  rawUrl: string;
  source: string;
}

interface SyncResult {
  success: boolean;
  count?: number;
  ingested?: number;
  updated?: number;
  error?: string;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 同步岗位数据到本地 Next.js 服务
 * 
 * @param jobs - 提取的岗位数据数组
 * @returns 同步结果
 */
export async function syncToNextJobs(jobs: JobIngestData[]): Promise<SyncResult> {
  if (jobs.length === 0) {
    return { success: false, error: "No jobs to sync" };
  }

  const localSecret = await getLocalSecret();

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `${NEXTJS_BASE_URL}/api/jobs/ingest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Local-Secret": localSecret,
          },
          body: JSON.stringify({ jobs }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        lastError = errorData.error || `HTTP ${response.status}`;

        if (response.status === 401) {
          return {
            success: false,
            error: "认证失败，请检查 Local Secret 配置",
          };
        }

        // 非认证错误，继续重试
        console.warn(
          `[JobRadar] Sync attempt ${attempt} failed: ${lastError}`
        );
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS * attempt);
          continue;
        }
        break;
      }

      const result = await response.json();

      if (result.success) {
        console.log(
          `[JobRadar] Sync success: ${result.ingested} new, ${result.updated} updated`
        );
        return {
          success: true,
          count: result.total,
          ingested: result.ingested,
          updated: result.updated,
        };
      }

      lastError = result.error || "Unknown error";
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";

      console.warn(
        `[JobRadar] Sync attempt ${attempt} failed: ${lastError}`
      );

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return {
    success: false,
    error: lastError || "All sync attempts failed",
  };
}

/**
 * 检查本地服务健康状态
 */
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${NEXTJS_BASE_URL}/api/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

/**
 * 获取本地共享密钥（从 Chrome Storage 读取）
 */
async function getLocalSecret(): Promise<string> {
  // 优先从 Storage 读取，否则使用默认值
  try {
    const result = await chrome.storage.local.get("localSecret");
    return (
      (result.localSecret as string) ||
      "job-radar-local-dev-secret-change-me"
    );
  } catch {
    return "job-radar-local-dev-secret-change-me";
  }
}

/**
 * 设置本地共享密钥
 */
export async function setLocalSecret(secret: string): Promise<void> {
  await chrome.storage.local.set({ localSecret: secret });
}
