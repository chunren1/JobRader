# JobRadar —— 个人效率工具

> 岗位信息管理 · AI 驱动 · 数据仅存储于本地

JobRadar 是一款基于 Chrome 浏览器插件 + Next.js + AI 的个人效率工具。通过插件一键提取招聘网站上的岗位数据，结合 AI 语义分析为你智能评分与匹配分析，帮你快速识别高质量岗位，过滤低质职位。

---

## 🖼️ 功能预览

### 岗位看板
一站式查看所有采集的岗位，支持搜索、筛选、排序、收藏，AI 评分一目了然。

![岗位看板](image/dashboard.png)

### 简历与匹配分析
填写个人信息与技能栈，AI 自动分析各岗位与你的匹配度，给出针对性建议。

![简历分析](image/resume-analysis.png)

### AI 评分配置
自定义 AI 评分权重，让评分规则更贴合你的个人偏好和求职策略。

![评分配置](image/scoring-config.png)

### 数据统计与分析
可视化图表展示 AI 评分分布、推荐等级占比、城市分布等，帮你宏观把握求职进展。

![数据分析](image/analytics.png)

### 数据导出
支持将岗位数据导出为 CSV/Excel 格式，方便离线存档和后续处理。

![CSV 导出](image/export-csv.png)

---

## ⚠️ 合规声明

本工具仅为个人信息管理辅助工具，**不与任何招聘平台官方关联**。

**不做：**
- ❌ 自动投递简历、批量打招呼
- ❌ 破解加密参数、绕过登录验证
- ❌ 服务端大规模爬取
- ❌ 对外提供数据接口

**只做：**
- ✅ 用户主动触发采集
- ✅ 个人数据本地处理
- ✅ 辅助信息整理与可视化
- ✅ 浏览器插件复用用户登录态

请遵守平台使用条款。

---

## 🏗️ 技术架构

```
用户浏览招聘网站
    │
    ▼
Chrome Extension (Content Script)
    │ 提取JD/列表
    ▼
Next.js Local API (localhost:3000)
    │
    ├──► PostgreSQL 数据库 (结构化存储)
    │
    └──► AI Worker (异步处理)
         │
         ├──► OpenAI/Claude API (结构化评分)
         └──► JD 哈希缓存 (降低Token成本)
              │
              ▼
         Dashboard 可视化看板
```

### 技术栈

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| 前端 | Next.js 14+ (App Router) + TailwindCSS | AI 代码生成质量高 |
| 图表 | Recharts | 声明式图表，易于集成 |
| 后端 | Next.js API Routes | 全栈统一 |
| 数据库 | PostgreSQL + Prisma ORM | Schema 驱动开发 |
| AI | OpenAI API + Zod | 结构化输出能力强 |
| 采集 | Chrome Extension (Plasmo) | 合规，绕过风控 |
| 部署 | Vercel + Vercel Cron | 免费额度够用 |

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- PostgreSQL 数据库（本地或用 Supabase/Turso）
- OpenAI API Key
- Chrome 浏览器

### 1. 克隆并安装依赖

```bash
cd job-radar
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的配置：

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/jobradar"
OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
LOCAL_SECRET="your-local-secret-string"
CRON_SECRET="your-cron-secret-string"
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma db push
npx prisma db seed  # 生成示例数据
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看主页，http://localhost:3000/dashboard 查看岗位看板。

### 5. 安装 Chrome 扩展

```bash
cd extension
npm install
npm run dev    # 开发模式（HMR热更新）
npm run build  # 生产构建
```

在 Chrome 中加载扩展：
1. 打开 `chrome://extensions/`
2. 启用「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/build/chrome-mv3-dev` 目录

---

## 📂 项目结构

```
job-radar/
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── health/route.ts     # 健康检查
│   │   ├── jobs/
│   │   │   ├── route.ts        # 岗位列表API
│   │   │   └── ingest/route.ts # 岗位入库API
│   │   ├── favorites/route.ts  # 收藏管理API
│   │   └── workers/
│   │       └── ai-analyze/
│   │           └── route.ts    # AI Worker入口
│   ├── dashboard/page.tsx      # 看板页面
│   ├── layout.tsx              # 根布局
│   └── page.tsx                # 主页
├── components/                 # React 组件
│   ├── analytics-charts.tsx    # 图表组件
│   ├── filter-bar.tsx          # 筛选栏
│   ├── job-card.tsx            # 岗位卡片
│   ├── pagination.tsx          # 分页
│   └── status-badge.tsx        # 状态徽章
├── extension/                  # Chrome Extension
│   ├── src/
│   │   ├── popup.tsx           # 弹窗页面
│   │   ├── background.ts       # 后台脚本
│   │   ├── contents/
│   │   │   └── page-content.tsx # 内容脚本
│   │   └── lib/
│   │       ├── extractor.ts    # 岗位提取器
│   │       └── sync.ts         # 通信模块
│   └── assets/                 # 图标资源
├── lib/                        # 工具库
│   ├── hooks/use-jobs.ts       # 数据Hook
│   ├── prisma.ts               # Prisma客户端
│   └── utils.ts                # 工具函数
├── prisma/
│   ├── schema.prisma           # 数据库Schema
│   └── seed.ts                 # 种子数据
├── schemas/
│   ├── job-ingest.ts           # 采集数据Zod校验
│   └── job-analysis.ts         # AI分析结果Zod校验
├── services/
│   ├── ai-job-analyzer.ts      # AI评分服务
│   └── ai-worker-service.ts    # AI Worker服务
├── vercel.json                 # Vercel部署配置
└── package.json
```

---

## 🔧 核心功能

### 1. AI 评分系统

AI 从四个维度对岗位进行量化评分：

- **技术匹配度** (tech): 技能与JD要求匹配度
- **薪资竞争力** (salary): 薪资与用户预期的对比
- **公司稳定性** (stability): 公司规模、行业地位
- **成长空间** (growth): 岗位对职业发展的价值

评分结果包含：综合得分 (0-100)、推荐等级、风险提示、匹配技术栈

### 2. JD 哈希缓存

对相同 JD 内容计算 SHA-256 哈希，缓存 AI 分析结果，避免重复分析相同岗位，降低 Token 成本。

### 3. 异步批处理队列

岗位入库后自动创建 AI 分析任务，Worker 定时消费处理，支持失败重试（最多 3 次）。

### 4. 可视化看板

- **评分分布图**：各分数段岗位数量
- **推荐等级饼图**：强烈推荐/可考虑/不推荐占比
- **城市分布图**：不同城市岗位分布
- **筛选功能**：城市、最低分、推荐等级、关键词搜索
- **收藏管理**：乐观更新 UI，支持笔记和标签

---

## 📊 API 端点

| 端点 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 无 |
| `/api/jobs` | GET | 岗位列表（支持筛选分页） | 无 |
| `/api/jobs/ingest` | POST | 岗位入库 | X-Local-Secret |
| `/api/favorites` | GET/POST/PATCH | 收藏管理 | 无 |
| `/api/workers/ai-analyze` | GET/POST | AI 批处理 | Bearer Token |

---

## 🚢 部署

### Vercel

```bash
npm run build
vercel deploy
```

在 Vercel Dashboard 中配置：
- 所有 `.env.local` 中的环境变量
- `CRON_SECRET` 环境变量

### 定时任务

`vercel.json` 已配置每 10 分钟触发 `/api/workers/ai-analyze`：

```json
{
  "crons": [
    {
      "path": "/api/workers/ai-analyze",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## 🧪 测试

```bash
# TypeScript 类型检查
npm run build

# 数据库 Studio (可视化)
npm run db:studio

# 手动触发 AI Worker (开发环境)
curl -X POST http://localhost:3000/api/workers/ai-analyze

# 测试岗位入库
curl -X POST http://localhost:3000/api/jobs/ingest \
  -H "Content-Type: application/json" \
  -H "X-Local-Secret: job-radar-local-dev-secret-change-me" \
  -d '{"jobs":[{"title":"测试岗位","company":"测试公司","location":"北京","jdContent":"这是一个测试JD","tags":["React"],"rawUrl":"https://example.com/test","source":"platform"}]}'
```

---

## 📝 开发规范

使用 AI 辅助开发时遵循以下规范：

1. **Context First**: 提供 tech-stack.md, schema.prisma, project-rules.md
2. **Atomic Tasks**: 拆解为单一职责的小任务
3. **Structured Output**: 强制 AI 返回 JSON/Zod Schema
4. **Safety Harness**: 禁止生成违反 ToS 的代码
5. **Compliance First**: 所有数据采集必须通过浏览器扩展，不做服务端爬取

---

## 📄 License

MIT License — 仅供个人学习使用。使用者需自行遵守相关平台的服务条款。
