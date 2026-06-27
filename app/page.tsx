import Link from "next/link";
import { Radar, ArrowRight, Shield, Cpu, BarChart3, Chrome } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Radar className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold tracking-tight">
              JobRadar
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              进入看板
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
              <Chrome className="h-4 w-4" />
              Chrome Extension + Next.js + AI
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight lg:text-6xl">
              用 AI 发现
              <span className="text-primary"> 真正适合你 </span>
              的岗位
            </h1>
            <p className="mb-10 text-lg text-muted-foreground leading-relaxed">
              JobRadar 是一款个人效率工具。通过 Chrome 浏览器插件在浏览 Boss 直聘时提取岗位数据，
              结合 AI 语义分析为你智能评分，帮你快速识别高质量岗位，过滤外包、虚假和低质职位。
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
              >
                打开岗位看板
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-12 text-center text-3xl font-bold">
              四大核心模块
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<Chrome className="h-8 w-8 text-blue-500" />}
                title="合规数据采集"
                description="Chrome 浏览器插件，仅在用户主动触发时提取当前页面数据，复用登录态，不绕过平台安全机制"
              />
              <FeatureCard
                icon={<Cpu className="h-8 w-8 text-purple-500" />}
                title="AI 智能评分"
                description="基于 LLM 的语义分析，从技术匹配、薪资竞争力、公司稳定性、成长空间四个维度综合打分"
              />
              <FeatureCard
                icon={<BarChart3 className="h-8 w-8 text-green-500" />}
                title="可视化看板"
                description="评分分布图、推荐等级占比、技能词云、薪资分析，让数据直观呈现，辅助决策"
              />
              <FeatureCard
                icon={<Shield className="h-8 w-8 text-orange-500" />}
                title="隐私安全第一"
                description="数据仅存储于本地/私有服务器，使用 JD 哈希缓存降低 AI 成本，绝不对外提供数据接口"
              />
            </div>
          </div>
        </section>

        {/* Compliance Notice */}
        <section className="border-t bg-muted/30 px-6 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-3 text-lg font-semibold">合规声明</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本工具仅为个人信息管理辅助工具，不与任何招聘平台官方关联。
              不做自动投递、批量操作、绕过认证等违规行为。
              请在遵守平台使用条款的前提下使用。
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        JobRadar v1.0.0 — 个人效率工具 · 数据仅存储于本地
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 text-left transition-shadow hover:shadow-md">
      <div className="mb-4">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
