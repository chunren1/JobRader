"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Radar, ArrowLeft, Loader2, User, Briefcase, GraduationCap, Code, Star, AlertTriangle, CheckCircle2, MapPin, Mail, Phone, Calendar, ExternalLink } from "lucide-react";
import { cn, formatSalary } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";

interface ResumeData {
  name?: string; title?: string; email?: string; phone?: string; city?: string;
  yearsOfExp?: string; summary?: string;
  education?: { school: string; degree: string; major: string; year: string };
  skills?: string[];
  experience?: { company: string; role: string; duration: string; summary: string }[];
  projects?: { name: string; role: string; tech: string[]; summary: string }[];
}

interface JobMatch {
  id: string; title: string; company: string; location: string;
  salaryMin: number | null; salaryMax: number | null;
  aiScore: number | null; aiSummary: string | null; aiRecommendation: string | null;
  aiTechMatch: string[]; aiRedFlags: string[]; aiSalaryMatch: string | null;
  aiDimensions: Record<string, number> | null;
  skillMatrix?: { skill: string; level: string; match: boolean }[];
  experienceFit?: string[];
  gaps?: string[];
  rawUrl: string;
}

export default function ResumePage() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 加载简历
      const resRes = await fetch("/api/resume");
      const resData = await resRes.json();

      if (!resData.success) {
        setError("请先上传简历");
        setLoading(false);
        return;
      }

      // 尝试结构化分析
      let structured: ResumeData = {};
      try {
        const structRes = await fetch("/api/resume/analyze");
        const structData = await structRes.json();
        if (structData.success) structured = structData.data;
      } catch { /* 分析失败用 rawText */ }

      setResume({ ...structured, summary: structured.summary || resData.data.text.substring(0, 200) });

      // 加载已评分的岗位
      const jobRes = await fetch("/api/jobs?limit=50");
      const jobData = await jobRes.json();
      if (jobData.success) {
        setJobs(jobData.data.filter((j: JobMatch) => j.aiScore !== null));
      }
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    await fetch("/api/resume/analyze").then(r => r.json());
    loadData();
    setAnalyzing(false);
  };

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-3 text-muted-foreground">加载简历数据...</span>
    </div>
  );

  if (error && !resume) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <User className="h-16 w-16 text-muted-foreground/30" />
      <p className="text-muted-foreground">{error}</p>
      <Link href="/dashboard" className="text-primary text-sm hover:underline">返回看板</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <AppSidebar />

        {/* Main */}
        <main className="flex-1 overflow-auto">
          {/* Header */}
          <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
            <div className="px-4 lg:px-8 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <Radar className="h-6 w-6 text-primary" />
                <h1 className="text-lg font-bold">简历分析</h1>
              </div>
              <button onClick={handleAnalyze} disabled={analyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                重新解析
              </button>
            </div>
          </header>

          <div className="px-4 lg:px-8 py-6">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Left: Resume */}
              <div className="lg:col-span-2 space-y-4">
            {/* Personal */}
            <SectionCard icon={<User className="h-5 w-5" />} title="个人信息">
              <div className="space-y-2">
                <div className="text-xl font-bold">{resume?.name || "未解析"}</div>
                {resume?.title && <div className="text-primary font-medium">{resume.title}</div>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {resume?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{resume.email}</span>}
                  {resume?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{resume.phone}</span>}
                  {resume?.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{resume.city}</span>}
                  {resume?.yearsOfExp && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{resume.yearsOfExp}</span>}
                </div>
              </div>
            </SectionCard>

            {/* Education */}
            {resume?.education && (
              <SectionCard icon={<GraduationCap className="h-5 w-5" />} title="教育背景">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{resume.education.school}</div>
                  <div className="text-muted-foreground">{resume.education.degree} · {resume.education.major}</div>
                  <div className="text-xs text-muted-foreground">{resume.education.year}</div>
                </div>
              </SectionCard>
            )}

            {/* Skills */}
            {resume?.skills && resume.skills.length > 0 && (
              <SectionCard icon={<Code className="h-5 w-5" />} title="技能">
                <div className="flex flex-wrap gap-1.5">
                  {resume.skills.map(s => (
                    <span key={s} className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{s}</span>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Experience */}
            {resume?.experience && resume.experience.length > 0 && (
              <SectionCard icon={<Briefcase className="h-5 w-5" />} title="工作经历">
                <div className="space-y-3">
                  {resume.experience.map((exp, i) => (
                    <div key={i} className="border-l-2 border-muted pl-3 text-sm">
                      <div className="font-medium">{exp.role}</div>
                      <div className="text-muted-foreground">{exp.company} · {exp.duration}</div>
                      <div className="text-xs text-muted-foreground mt-1">{exp.summary}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Projects */}
            {resume?.projects && resume.projects.length > 0 && (
              <SectionCard icon={<Star className="h-5 w-5" />} title="项目经验">
                <div className="space-y-3">
                  {resume.projects.map((p, i) => (
                    <div key={i} className="border-l-2 border-primary/30 pl-3 text-sm">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.role}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.tech.map(t => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right: Job Match */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-bold mb-4">岗位匹配分析 ({jobs.length} 个已评分岗位)</h2>
            {jobs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>暂无可分析的岗位</p>
                <p className="text-xs mt-1">去看板提取岗位并等待 AI 评分后查看</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0)).map(job => (
                  <JobMatchCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// 岗位匹配卡片
function JobMatchCard({ job }: { job: JobMatch }) {
  const scoreColor = (job.aiScore || 0) >= 80 ? "text-green-600" : (job.aiScore || 0) >= 60 ? "text-yellow-600" : "text-red-600";
  const scoreBg = (job.aiScore || 0) >= 80 ? "bg-green-50 border-green-200" : (job.aiScore || 0) >= 60 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <div className={cn("rounded-xl border p-5", scoreBg)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">
              <a href={job.rawUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline inline-flex items-center gap-1">
                {job.title} <ExternalLink className="h-3 w-3" />
              </a>
            </h3>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {job.company} · {job.location} · {formatSalary(job.salaryMin, job.salaryMax)}
          </div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className={cn("text-3xl font-bold", scoreColor)}>{job.aiScore}</div>
          <div className="text-xs text-muted-foreground">综合分</div>
        </div>
      </div>

      {/* AI Summary */}
      {job.aiSummary && (
        <div className="text-sm text-muted-foreground mb-3 leading-relaxed">{job.aiSummary}</div>
      )}

      {/* Recommendation */}
      {job.aiRecommendation && (
        <span className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mb-3",
          job.aiRecommendation === "强烈推荐" ? "bg-green-100 text-green-700" :
          job.aiRecommendation === "可以考虑" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
        )}>{job.aiRecommendation}</span>
      )}

      {/* Dimensions */}
      {job.aiDimensions && (
        <div className="grid grid-cols-4 gap-3 mb-3">
          {[
            { k: "tech", label: "技术匹配", color: "bg-blue-500" },
            { k: "salary", label: "薪资竞争力", color: "bg-green-500" },
            { k: "stability", label: "公司稳定", color: "bg-purple-500" },
            { k: "growth", label: "成长空间", color: "bg-orange-500" },
          ].map(d => {
            const v = job.aiDimensions?.[d.k] || 0;
            return (
              <div key={d.k} className="text-center">
                <div className="text-lg font-bold">{v}</div>
                <div className="text-[10px] text-muted-foreground">{d.label}</div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", d.color)} style={{ width: v + "%" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skill Matrix */}
      {job.skillMatrix && job.skillMatrix.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">技能匹配详情</h4>
          <div className="space-y-1">
            {job.skillMatrix.map(s => (
              <div key={s.skill} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  {s.match ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
                  {s.skill}
                </span>
                <span className={cn("font-medium", s.match ? "text-green-600" : "text-red-500")}>{s.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience Fit */}
      {job.experienceFit && job.experienceFit.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase text-green-600 mb-1">经验契合点</h4>
          <ul className="space-y-0.5">
            {job.experienceFit.map((f, i) => (
              <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {job.gaps && job.gaps.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase text-red-600 mb-1">能力差距</h4>
          <ul className="space-y-0.5">
            {job.gaps.map((g, i) => (
              <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />{g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Red Flags */}
      {job.aiRedFlags && job.aiRedFlags.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-red-600 mb-1">风险提示</h4>
          <div className="flex flex-wrap gap-1.5">
            {job.aiRedFlags.map((f, i) => (
              <span key={i} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">{f}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 通用区块卡片
function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}
