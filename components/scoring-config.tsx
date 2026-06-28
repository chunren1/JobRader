"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Save, ToggleLeft, ToggleRight, GripVertical, Loader2 } from "lucide-react";

interface Field {
  id: string; name: string; type: "system" | "custom"; enabled: boolean; weight: number; maxScore: number;
}

import { toast } from "@/components/toast";

const defaultFields: Field[] = [
  { id: "tech", name: "技术匹配度", type: "system", enabled: true, weight: 35, maxScore: 100 },
  { id: "salary", name: "薪资竞争力", type: "system", enabled: true, weight: 25, maxScore: 100 },
  { id: "stability", name: "公司稳定性", type: "system", enabled: true, weight: 20, maxScore: 100 },
  { id: "growth", name: "成长空间", type: "system", enabled: true, weight: 20, maxScore: 100 },
];

const fieldDescriptions: Record<string, string> = {
  tech: "简历技能与JD要求的重合度",
  salary: "岗位薪资是否在期望范围内",
  stability: "公司规模、融资阶段、行业前景",
  growth: "岗位对职业发展的提升价值",
};

export function ScoringConfig() {
  const [fields, setFields] = useState<Field[]>(defaultFields);
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/scoring").then(r => r.json()).then(d => {
      if (d.success) {
        if (d.data?.fields) setFields(d.data.fields);
        if (d.data?.rules) setRules(d.data.rules);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalWeight = fields.filter(f => f.enabled).reduce((s, f) => s + f.weight, 0);

  const toggle = useCallback((id: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  }, []);

  const setWeight = useCallback((id: string, w: number) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, weight: Math.max(0, Math.min(100, w)) } : f));
  }, []);

  const setMaxScore = useCallback((id: string, m: number) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, maxScore: Math.max(1, m) } : f));
  }, []);

  const rename = useCallback((id: string, name: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  }, []);

  const addCustom = useCallback(() => {
    const id = "custom_" + Date.now();
    setFields(prev => [...prev, { id, name: "新维度", type: "custom", enabled: true, weight: 10, maxScore: 100 }]);
  }, []);

  const removeCustom = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/scoring", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields, rules }) });
      toast("评分配置已保存，下次分析生效", "success");
    } catch {
      toast("保存失败", "error");
    }
    setSaving(false);
  }, [fields]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const systemFields = fields.filter(f => f.type === "system");
  const customFields = fields.filter(f => f.type === "custom");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI 评分配置</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            权重总和 {totalWeight}% {totalWeight !== 100 && <span className="text-red-500">（应为100%）</span>}
          </p>
        </div>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存
        </button>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
        <strong>综合分 = Σ(各维度得分 × 权重)</strong>。系统维度按 JD 内容客观评分，自定义维度由你设定标准。
      </div>

      {/* Scoring Rules */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">评分规则</h2>
        <p className="text-xs text-muted-foreground">在这里描述你的求职偏好，AI 评分时会严格参照。例如：</p>
        <textarea
          value={rules}
          onChange={e => setRules(e.target.value)}
          placeholder={"只评实习岗位\n期望薪资3k-8k\n工作地点广州\n不接受外包/驻场\n支持远程办公"}
          rows={5}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
        />
        <p className="text-[10px] text-muted-foreground">每条一行，用自然语言描述。AI 会根据这些规则调整评分结果。</p>
      </div>

      {/* System Fields */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-semibold text-muted-foreground">系统预设维度</h2>
        </div>
        <div className="divide-y">
          {systemFields.map(f => (
            <div key={f.id}>
              <FieldRow field={f} onToggle={toggle} onWeight={setWeight} onMaxScore={setMaxScore} onRename={rename} />
              <div className="px-5 pb-2 text-[10px] text-muted-foreground ml-10">{fieldDescriptions[f.id] || ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Fields */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">自定义维度</h2>
          <button onClick={addCustom}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3 w-3" />新增</button>
        </div>
        {customFields.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            添加自定义评分标准，如「远程办公匹配度」「英语能力匹配度」
          </div>
        ) : (
          <div className="divide-y">
            {customFields.map(f => (
              <div key={f.id}>
                <FieldRow field={f} onToggle={toggle} onWeight={setWeight} onMaxScore={setMaxScore} onRename={rename} onDelete={removeCustom} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ field, onToggle, onWeight, onMaxScore, onRename, onDelete }: {
  field: Field;
  onToggle: (id: string) => void;
  onWeight: (id: string, w: number) => void;
  onMaxScore: (id: string, m: number) => void;
  onRename: (id: string, n: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className={`px-5 py-3 flex items-center gap-4 transition-colors ${!field.enabled ? "opacity-50" : ""}`}>
      <GripVertical className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />

      {/* Toggle */}
      <button onClick={() => onToggle(field.id)} className="flex-shrink-0">
        {field.enabled
          ? <ToggleRight className="h-5 w-5 text-primary" />
          : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
      </button>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {field.type === "custom" ? (
          <input value={field.name} onChange={e => onRename(field.id, e.target.value)}
            className="w-full font-medium text-sm bg-transparent border-b border-dashed border-muted-foreground/30 focus:outline-none focus:border-primary px-1" />
        ) : (
          <span className="font-medium text-sm">{field.name}</span>
        )}
      </div>

      {/* Weight */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <input type="number" value={field.weight} onChange={e => onWeight(field.id, parseInt(e.target.value) || 0)}
          className="w-12 text-center text-sm rounded-md border px-1 py-0.5 focus:outline-none focus:border-primary" min="0" max="100" />
        <span className="text-xs text-muted-foreground">%</span>
      </div>

      {/* Max Score */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-muted-foreground">上限</span>
        <input type="number" value={field.maxScore} onChange={e => onMaxScore(field.id, parseInt(e.target.value) || 1)}
          className="w-12 text-center text-sm rounded-md border px-1 py-0.5 focus:outline-none focus:border-primary" min="1" />
      </div>

      {/* Delete (custom only) */}
      {onDelete && (
        <button onClick={() => onDelete(field.id)} className="flex-shrink-0 text-muted-foreground hover:text-red-500">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
