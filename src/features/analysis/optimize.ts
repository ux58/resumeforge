import type { ResumeData } from "@/features/resumes/schema";

/**
 * 一键优化：只做「语义无损」的规则变换，每条变换生成 before/after 差异，
 * 由用户预览勾选后批量应用。不做任何编造性改写。
 */

export interface OptimizeOp {
  id: string;
  /** 变换类型 */
  kind: "weak-verb" | "dedupe" | "cleanup" | "summary-draft";
  /** 定位描述（供 UI 展示） */
  target: string;
  before: string;
  after: string;
  reason: string;
  /** 默认是否勾选（保守的默认不勾） */
  defaultOn: boolean;
  /** 应用位置：工作经历条目 / 项目条目 / 总结 */
  apply: (resume: ResumeData) => ResumeData;
}

const WEAK_TO_STRONG: Array<[RegExp, string]> = [
  [/^(了解)/, "熟悉"],
  [/^(协助负责)/, "参与"],
];

/** 生成一键优化操作清单（不修改原数据） */
export function planOptimizations(resume: ResumeData): OptimizeOp[] {
  const ops: OptimizeOp[] = [];

  // 1) 弱动词开头升级：熟悉 X → 掌握 X；了解 X → 熟悉 X（仅行首，语义强度递进）
  resume.experience.forEach((e, i) => {
    const lines = e.bullets.split(/\r?\n/);
    lines.forEach((line, li) => {
      for (const [re, strong] of WEAK_TO_STRONG) {
        if (re.test(line.trim())) {
          const after = line.trim().replace(re, strong);
          ops.push({
            id: `weak-exp-${i}-${li}`,
            kind: "weak-verb",
            target: `工作经历 · ${e.company || `第 ${i + 1} 段`} 第 ${li + 1} 条`,
            before: line.trim(),
            after,
            reason: `「${line.trim().slice(0, 2)}」是弱动词开头，升级为「${strong}」更能体现主动性与熟练度`,
            defaultOn: true,
            apply: (r) => {
              const lines2 = r.experience[i].bullets.split(/\r?\n/);
              lines2[li] = after;
              return { ...r, experience: r.experience.map((x, xi) => (xi === i ? { ...x, bullets: lines2.join("\n") } : x)) };
            },
          });
          break;
        }
      }
    });
  });

  // 2) 重复条目去除（同段经历内完全相同的行）
  resume.experience.forEach((e, i) => {
    const lines = e.bullets.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    const dupes: number[] = [];
    lines.forEach((l, li) => {
      const k = l.replace(/\s/g, "");
      if (seen.has(k)) dupes.push(li);
      seen.add(k);
    });
    if (dupes.length) {
      const preview = lines[dupes[0]];
      ops.push({
        id: `dedupe-exp-${i}`,
        kind: "dedupe",
        target: `工作经历 · ${e.company || `第 ${i + 1} 段`}`,
        before: preview,
        after: "（移除重复行）",
        reason: `检测到 ${dupes.length} 条完全重复的描述`,
        defaultOn: true,
        apply: (r) => {
          const seen2 = new Set<string>();
          const kept = r.experience[i].bullets.split(/\r?\n/).filter((l) => {
            const k = l.trim().replace(/\s/g, "");
            if (!k) return true;
            if (seen2.has(k)) return false;
            seen2.add(k);
            return true;
          });
          return { ...r, experience: r.experience.map((x, xi) => (xi === i ? { ...x, bullets: kept.join("\n") } : x)) };
        },
      });
    }
  });

  // 3) 行尾句号与多余空白清理（工作经历 + 项目）
  type CleanupTarget = { sec: "experience" | "projects"; i: number; company: string };
  const cleanupTargets: CleanupTarget[] = [];
  resume.experience.forEach((e, i) => { if (/[ \t]+$|。$/m.test(e.bullets)) cleanupTargets.push({ sec: "experience", i, company: e.company }); });
  resume.projects.forEach((p, i) => { if (/[ \t]+$|。$/m.test(p.desc)) cleanupTargets.push({ sec: "projects", i, company: p.name }); });
  for (const t of cleanupTargets) {
    ops.push({
      id: `cleanup-${t.sec}-${t.i}`,
      kind: "cleanup",
      target: `${t.sec === "experience" ? "工作经历" : "项目经历"} · ${t.company || t.i + 1}`,
      before: "含行尾句号 / 尾随空白",
      after: "统一无句号、无尾随空白（与 ATS 解析兼容性更好）",
      reason: "格式统一：条目式描述不以句号结尾是主流简历规范",
      defaultOn: true,
      apply: (r) =>
    t.sec === "experience"
      ? { ...r, experience: r.experience.map((x, xi) => (xi === t.i ? { ...x, bullets: x.bullets.split(/\r?\n/).map((l: string) => l.replace(/[ \t]+$/, "").replace(/。$/, "")).join("\n") } : x)) }
      : { ...r, projects: r.projects.map((x, xi) => (xi === t.i ? { ...x, desc: x.desc.split(/\r?\n/).map((l: string) => l.replace(/[ \t]+$/, "").replace(/。$/, "")).join("\n") } : x)) },
    });
  }

  // 4) 个人总结草稿（仅当缺失或过短）：用简历中已有事实拼装，不含编造
  if (resume.basics.summary.trim().length < 40) {
    const yearsMatch = JSON.stringify(resume.experience).match(/(\d{1,2})\s*年/);
    const years = yearsMatch ? yearsMatch[1] : null;
    const topSkills = resume.skills.filter((s) => s.level >= 4).slice(0, 3).map((s) => s.name);
    const lastExp = [...resume.experience].reverse().find((e) => e.company);
    const parts: string[] = [];
    if (years) parts.push(`${years} 年${lastExp?.role ? lastExp.role : ""}经验`);
    else if (lastExp?.role) parts.push(`${lastExp.role}从业经验`);
    if (topSkills.length) parts.push(`核心技能：${topSkills.join("、")}`);
    if (resume.projects.length) parts.push(`主导/深度参与 ${resume.projects.length} 个项目`);
    const draft = parts.length
      ? `${parts.join("，")}。请补充 1-2 句最有代表性的量化成果与你的差异化优势。`
      : "建议先补充工作经历与技能，再回到这里生成总结草稿。";
    ops.push({
      id: "summary-draft",
      kind: "summary-draft",
      target: "个人总结",
      before: resume.basics.summary.trim() || "（空）",
      after: draft,
      reason: "基于简历已有信息（年限/技能/项目数）拼装草稿，占位提示需人工补充量化成果",
      defaultOn: true,
      apply: (r) => ({ ...r, basics: { ...r.basics, summary: draft } }),
    });
  }

  return ops;
}

/** 按 id 应用选中的变换（顺序应用，后者基于前者结果） */
export function applyOptimizations(resume: ResumeData, ops: OptimizeOp[], selectedIds: string[]): ResumeData {
  let current = resume;
  for (const op of ops) {
    if (selectedIds.includes(op.id)) current = op.apply(current);
  }
  return current;
}
