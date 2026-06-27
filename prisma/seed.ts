import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 种子数据：创建示例岗位用于 Dashboard 开发调试
 */
async function main() {
  console.log("🌱 Seeding database...");

  // 清空现有数据
  await prisma.aiAnalysisCache.deleteMany();
  await prisma.aiAnalysisTask.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.job.deleteMany();

  // 创建示例岗位
  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        title: "高级前端工程师",
        company: "字节跳动",
        salaryMin: 35000,
        salaryMax: 60000,
        location: "北京",
        jdContent: "负责抖音电商前端架构设计与开发，熟悉 React/TypeScript/Node.js，有大型项目经验优先。参与微前端、SSR、性能优化等方向的技术探索。",
        tags: ["React", "TypeScript", "Next.js", "微前端"],
        rawUrl: "https://example.com/job_detail/mock_001.html",
        aiScore: 92,
        aiSummary: "顶尖大厂核心业务，技术栈高度匹配，薪资竞争力强",
        aiRecommendation: "强烈推荐",
        aiTechMatch: ["React", "TypeScript", "Next.js"],
        aiRedFlags: ["工作强度较大"],
        aiSalaryMatch: "符合预期",
        aiDimensions: { tech: 95, salary: 88, stability: 85, growth: 90 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "全栈开发工程师",
        company: "某创业公司",
        salaryMin: 25000,
        salaryMax: 40000,
        location: "上海",
        jdContent: "参与公司核心产品全栈开发，使用 React + Node.js + PostgreSQL 技术栈。要求 3 年以上开发经验，有 AI/LLM 相关经验加分。",
        tags: ["React", "Node.js", "PostgreSQL", "AI"],
        rawUrl: "https://example.com/job_detail/mock_002.html",
        aiScore: 78,
        aiSummary: "技术栈完全匹配，创业公司成长空间大但薪资略低于预期",
        aiRecommendation: "可以考虑",
        aiTechMatch: ["React", "Node.js", "PostgreSQL"],
        aiRedFlags: ["公司规模小"],
        aiSalaryMatch: "低于预期",
        aiDimensions: { tech: 85, salary: 65, stability: 50, growth: 80 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "Java 后端开发",
        company: "某外包公司",
        salaryMin: 15000,
        salaryMax: 25000,
        location: "深圳",
        jdContent: "负责客户项目的 Java 后端开发，需接受驻场和出差安排。要求 2 年 Java 经验，熟悉 Spring Boot。",
        tags: ["Java", "Spring Boot", "MySQL"],
        rawUrl: "https://example.com/job_detail/mock_003.html",
        aiScore: 35,
        aiSummary: "外包公司驻场岗，技术栈不匹配，薪资偏低，成长空间有限",
        aiRecommendation: "不推荐",
        aiTechMatch: [],
        aiRedFlags: ["外包公司", "需驻场出差", "技术栈不匹配", "薪资偏低"],
        aiSalaryMatch: "低于预期",
        aiDimensions: { tech: 20, salary: 30, stability: 25, growth: 15 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "AI 应用开发工程师",
        company: "Minimax",
        salaryMin: 40000,
        salaryMax: 70000,
        location: "北京",
        jdContent: "参与大模型应用层开发，优化推理性能，构建 RAG 系统。要求熟练使用 Python/TypeScript，了解 LangChain/LlamaIndex，有大模型相关项目经验。",
        tags: ["Python", "TypeScript", "LLM", "LangChain"],
        rawUrl: "https://example.com/job_detail/mock_004.html",
        aiScore: 88,
        aiSummary: "AI 赛道独角兽，技术方向前沿，薪资顶级，成长空间巨大",
        aiRecommendation: "强烈推荐",
        aiTechMatch: ["TypeScript", "LLM"],
        aiRedFlags: ["创业公司存在不确定性"],
        aiSalaryMatch: "高于预期",
        aiDimensions: { tech: 92, salary: 95, stability: 60, growth: 95 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "远程 React 开发",
        company: "Stripe",
        salaryMin: 50000,
        salaryMax: 80000,
        location: "杭州",
        jdContent: "远程办公，负责 Stripe Dashboard 前端开发。需要精通 React/TypeScript，良好的英语沟通能力，有开源项目经验优先。",
        tags: ["React", "TypeScript", "Remote", "English"],
        rawUrl: "https://example.com/job_detail/mock_005.html",
        aiScore: 96,
        aiSummary: "国际化远程岗位，技术氛围好，薪资远超预期，完美符合远程办公偏好",
        aiRecommendation: "强烈推荐",
        aiTechMatch: ["React", "TypeScript"],
        aiRedFlags: ["英语沟通要求较高"],
        aiSalaryMatch: "高于预期",
        aiDimensions: { tech: 90, salary: 98, stability: 85, growth: 92 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "Node.js 后端开发",
        company: "美团",
        salaryMin: 30000,
        salaryMax: 50000,
        location: "北京",
        jdContent: "负责美团外卖核心业务后端开发，高并发分布式系统。精通 Node.js/Go，熟悉微服务架构、消息队列、K8s。",
        tags: ["Node.js", "Go", "K8s", "微服务"],
        rawUrl: "https://example.com/job_detail/mock_006.html",
        aiScore: 65,
        aiSummary: "大厂稳定但技术栈部分不匹配，需要 Go 语言经验",
        aiRecommendation: "可以考虑",
        aiTechMatch: ["Node.js", "微服务"],
        aiRedFlags: ["业务方向与偏好不一致"],
        aiSalaryMatch: "符合预期",
        aiDimensions: { tech: 60, salary: 75, stability: 90, growth: 55 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "前端实习生",
        company: "百度",
        salaryMin: 3000,
        salaryMax: 6000,
        location: "北京",
        jdContent: "百度搜索部门招聘前端实习生，熟悉 HTML/CSS/JavaScript，有 React 经验优先。",
        tags: ["HTML", "CSS", "JavaScript", "React"],
        rawUrl: "https://example.com/job_detail/mock_007.html",
        aiScore: 10,
        aiSummary: "实习生岗位，薪资极低，与高级工程师背景完全不匹配",
        aiRecommendation: "不推荐",
        aiTechMatch: [],
        aiRedFlags: ["实习生岗位", "薪资极低", "职级不匹配"],
        aiSalaryMatch: "低于预期",
        aiDimensions: { tech: 15, salary: 5, stability: 40, growth: 20 },
        analyzedAt: new Date(),
      },
    }),
    prisma.job.create({
      data: {
        title: "DevOps 工程师",
        company: "阿里云",
        salaryMin: 35000,
        salaryMax: 55000,
        location: "杭州",
        jdContent: "负责云原生基础设施建设和运维自动化，熟悉 Docker/K8s/Terraform，有 CI/CD 流水线搭建经验。",
        tags: ["Docker", "K8s", "Terraform", "CI/CD"],
        rawUrl: "https://example.com/job_detail/mock_008.html",
        aiScore: 45,
        aiSummary: "阿里云稳定但方向偏运维，与全栈开发偏好不完全匹配",
        aiRecommendation: "可以考虑",
        aiTechMatch: [],
        aiRedFlags: ["方向偏运维而非开发"],
        aiSalaryMatch: "符合预期",
        aiDimensions: { tech: 40, salary: 75, stability: 88, growth: 35 },
        analyzedAt: new Date(),
      },
    }),
  ]);

  // 创建示例收藏
  await prisma.userFavorite.create({
    data: {
      jobId: jobs[0].id,
      tags: ["重点跟进", "Dream公司"],
      notes: "字节抖音电商，核心业务，技术栈完全匹配，尽快投递",
    },
  });

  await prisma.userFavorite.create({
    data: {
      jobId: jobs[4].id,
      tags: ["远程", "高优先级"],
      notes: "Stripe 远程岗位，完美匹配，需要准备英语面试",
    },
  });

  console.log(`✅ Seeded ${jobs.length} jobs and 2 favorites`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
