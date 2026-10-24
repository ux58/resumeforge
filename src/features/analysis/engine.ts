import type { ResumeData } from "@/features/resumes/schema";

/**
 * 简历优化引擎：纯函数评分 + 可执行建议。
 * 六个维度：完整度 / 量化成果 / 行动动词 / 关键词匹配 / 简洁性 / 联系方式。
 * 规则基于招聘与 ATS 通用实践，全部本地计算，无外部依赖。
 */

export interface Suggestion {
  /** 严重度：high 影响筛选 / medium 明显提升 / low 锦上添花 */
  severity: "high" | "medium" | "low";
  /** 定位到编辑器的模块标识 */
  target: "basics" | "summary" | "experience" | "education" | "projects" | "skills" | "certs" | "targetJob";
  message: string;
}

export interface DimensionScore {
  key: "completeness" | "quantify" | "action" | "keywords" | "concise" | "contact";
  label: string;
  score: number; // 0-100
}

export interface AnalysisResult {
  total: number; // 0-100 加权总分
  dimensions: DimensionScore[];
  suggestions: Suggestion[];
  keywords: { matched: string[]; missing: string[] };
  stats: { bullets: number; words: number };
}

const ACTION_VERBS = [
  "主导", "负责", "搭建", "设计", "开发", "实现", "优化", "重构", "推动", "落地", "交付", "建立", "制定", "完成",
  "提升", "降低", "节省", "扩展", "引入", "沉淀", "统筹", "协调", "培养", "带队", "完成", "达成", "拿下",
  "led", "built", "designed", "developed", "improved", "optimized", "reduced", "increased", "delivered",
  "launched", "managed", "owned", "drove", "shipped", "architected",
];

const QUANT_RE = /(\d+(\.\d+)?\s*[%％])|(\d+\s*(万|w|W|k|K|千|亿))|(\d+\s*(人|天|周|个月|小时|倍|次|个|台|单))|(\$\s*\d+)|(Q[1-4].*提升)/;
const FILLER_RE = /(熟悉|了解|掌握|负责相关工作|参与|协助)([、,，]?)/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?:\+?\d[\d\s-]{7,17}\d)$/;

function splitBullets(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[。；;])\s*/)
    .map((s) => s.replace(/^[-•·*\d.、\s]+/, "").trim())
    .filter((s) => s.length > 0);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 从 JD 与简历正文提取关键词（朴素分词：2-6 字中文片段 + 英文单词），返回 JD 有而简历缺的高频词 */
function extractKeywords(jd: string, resumeText: string): { matched: string[]; missing: string[] } {
  const normalize = (s: string) => s.toLowerCase();
  const jdTokens = new Set<string>();
  const enWords = jd.match(/[a-zA-Z][a-zA-Z0-9+#.\-]{1,20}/g) ?? [];
  for (const w of enWords) {
    if (STOP_EN.has(normalize(w))) continue;
    jdTokens.add(w); // 保留原始大小写：技术名词（Terraform/K8s）以原样展示
  }
  // 中文：按标点切分，剔除拉丁字母后滑窗提取 2-6 字纯中文片段（避免把英文单词切碎产生噪声）
  const segments = jd.split(/[，。、；！？：\s（）()【】\[\]"“”'']/).filter((s) => s.length >= 2);
  for (const rawSeg of segments) {
    for (const seg of rawSeg.split(/[a-zA-Z0-9+#.\-/]+/)) {
      if (!/^[\u4e00-\u9fff]{2,}$/.test(seg)) continue;
      for (let len = 2; len <= Math.min(6, seg.length); len++) {
        for (let i = 0; i + len <= seg.length; i++) jdTokens.add(seg.slice(i, i + len));
      }
    }
  }
  const resumeLower = normalize(resumeText);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const token of jdTokens) {
    if (token.length < 2) continue;
    if (STOP_CN.has(token)) continue;
    (resumeLower.includes(token) ? matched : missing).push(token);
  }
  // missing 保留出现顺序中的前若干个（JD 越早出现的词权重直觉上越高）
  return { matched: matched.slice(0, 20), missing: missing.slice(0, 12) };
}

const STOP_EN = new Set(["the", "and", "for", "with", "you", "our", "will", "are", "have", "has", "this", "that", "from", "job", "work", "team", "role"]);
const STOP_CN = new Set(["我们", "一个", "以及", "或者", "通过", "进行", "相关", "以上", "能够", "优先", "负责", "工作", "具备", "具有", "良好", "较强", "公司", "岗位", "要求", "职责", "任职", "描述", "加分", "熟悉者优先"]);

export function analyzeResume(resume: ResumeData): AnalysisResult {
  const suggestions: Suggestion[] = [];
  const b = resume.basics;

  // ---------- 完整度 ----------
  const modules: Array<[string, boolean, number]> = [
    ["basics", !!(b.name && b.headline), 15],
    ["summary", b.summary.length >= 40, 20],
    ["experience", resume.experience.length > 0, 25],
    ["education", resume.education.length > 0, 15],
    ["skills", resume.skills.length >= 4, 15],
    ["projects", resume.projects.length > 0, 10],
  ];
  let completeness = 0;
  for (const [target, filled, weight] of modules) {
    if (filled) completeness += weight;
    else if (target !== "projects") {
      suggestions.push({
        severity: target === "experience" || target === "summary" ? "high" : "medium",
        target: target as Suggestion["target"],
        message:
          target === "basics"
            ? "姓名与求职意向（headline）尚未填写，招聘方第一眼看到的就是它们"
            : target === "summary"
              ? "缺少个人总结：用 2-3 句话概括你的定位、年限与核心优势（40 字以上）"
              : target === "skills"
                ? "技能清单少于 4 项：列出与目标岗位最相关的技能，并标注熟练度"
                : `请补充${MODULE_NAMES[target]}模块`,
      });
    }
  }
  completeness = clamp(completeness);

  // ---------- 量化成果 ----------
  const bullets = resume.experience.flatMap((e) => splitBullets(e.bullets))
    .concat(resume.projects.flatMap((p) => splitBullets(p.desc)));
  const quantified = bullets.filter((s) => QUANT_RE.test(s));
  const quantRatio = bullets.length ? quantified.length / bullets.length : 0;
  const quantify = clamp(bullets.length === 0 ? (resume.experience.length ? 20 : 0) : 30 + quantRatio * 70);
  if (bullets.length > 0 && quantRatio < 0.5) {
    suggestions.push({
      severity: "high",
      target: "experience",
      message: `仅 ${quantified.length}/${bullets.length} 条成果包含数字。用「提升了 X%」「服务 X 万用户」「节省 X 小时」量化价值，通过率显著提高`,
    });
  }

  // ---------- 行动动词 ----------
  const actioned = bullets.filter((s) => ACTION_VERBS.some((v) => s.startsWith(v) || s.toLowerCase().startsWith(v)));
  const actionRatio = bullets.length ? actioned.length / bullets.length : 0;
  const action = clamp(bullets.length === 0 ? 0 : 25 + actionRatio * 75);
  if (bullets.length > 0 && actionRatio < 0.6) {
    suggestions.push({
      severity: "medium",
      target: "experience",
      message: "部分条目以「熟悉/参与/协助」等弱动词开头。改为「主导」「搭建」「优化」等强动词开头，凸显主动性与Ownership",
    });
  }
  const fillerHits = bullets.filter((s) => FILLER_RE.test(s.slice(0, 8))).length;
  if (fillerHits > 0) {
    suggestions.push({ severity: "low", target: "experience", message: `有 ${fillerHits} 条以「熟悉/参与」开头——这类词是简历弱化信号，建议替换为成果导向的表述` });
  }

  // ---------- 关键词匹配（JD 对照；对比文本排除 targetJob 自身，否则 JD 永远"已覆盖"） ----------
  const resumeText = JSON.stringify({ basics: b, education: resume.education, experience: resume.experience, projects: resume.projects, skills: resume.skills, certs: resume.certs, customs: resume.customs });
  const { matched, missing } = extractKeywords(resume.targetJob, resumeText);
  const jdWords = resume.targetJob.trim().length;
  const keywords = jdWords >= 30 ? clamp((matched.length / Math.max(1, matched.length + missing.length)) * 100) : 0;
  if (jdWords < 30) {
    suggestions.push({ severity: "medium", target: "targetJob", message: "粘贴目标职位的 JD（岗位职责/任职要求），可获得关键词匹配分析与补齐建议" });
  } else if (missing.length > 0) {
    suggestions.push({
      severity: missing.length > 6 ? "high" : "medium",
      target: "targetJob",
      message: `JD 中出现但简历未覆盖的关键词：${missing.slice(0, 6).join("、")}。若确实具备相关经验，请补进对应条目`,
    });
  }

  // ---------- 简洁性 ----------
  let concise = 100;
  let deductions = 0;
  const longBullets = bullets.filter((s) => s.length > 80);
  if (longBullets.length > 0) {
    deductions += Math.min(30, longBullets.length * 10);
    suggestions.push({ severity: "low", target: "experience", message: `${longBullets.length} 条描述超过 80 字：单条成果控制在 1-2 行，拆分或精炼` });
  }
  if (b.summary.length > 400) {
    deductions += 15;
    suggestions.push({ severity: "low", target: "summary", message: "个人总结过长（>400 字），建议压缩到 100-200 字的黄金区间" });
  }
  if (resume.skills.length > 25) {
    deductions += 10;
    suggestions.push({ severity: "low", target: "skills", message: "技能超过 25 项显得堆砌：保留与岗位强相关的核心技能" });
  }
  concise = clamp(concise - deductions);

  // ---------- 联系方式 ----------
  let contact = 0;
  if (b.name) contact += 20;
  if (EMAIL_RE.test(b.email)) contact += 30;
  else if (b.email) suggestions.push({ severity: "high", target: "basics", message: `邮箱格式似有误（${b.email}），招聘系统解析失败会直接丢简历` });
  else suggestions.push({ severity: "high", target: "basics", message: "缺少邮箱——正式求职简历必备联系方式" });
  if (PHONE_RE.test(b.phone)) contact += 30;
  else if (b.phone) suggestions.push({ severity: "medium", target: "basics", message: "手机号格式建议校验：纯数字或 +86 前缀，避免夹杂文字" });
  else suggestions.push({ severity: "medium", target: "basics", message: "建议填写手机号，HR 电话初筛仍是主流触达方式" });
  if (b.location) contact += 20;
  else suggestions.push({ severity: "low", target: "basics", message: "补充所在城市，方便 HR 判断到岗可能性与匹配远程/驻场" });
  contact = clamp(contact);

  // 提供 JD 时关键词参与权重；否则权重摊回其他维度
  const total =
    jdWords >= 30
      ? clamp(completeness * 0.28 + quantify * 0.22 + action * 0.15 + keywords * 0.15 + concise * 0.1 + contact * 0.1)
      : clamp(completeness * 0.33 + quantify * 0.26 + action * 0.17 + concise * 0.12 + contact * 0.12);

  const dimensions: DimensionScore[] = [
    { key: "completeness", label: "完整度", score: completeness },
    { key: "quantify", label: "量化成果", score: quantify },
    { key: "action", label: "行动动词", score: action },
    { key: "keywords", label: "关键词匹配", score: keywords },
    { key: "concise", label: "简洁性", score: concise },
    { key: "contact", label: "联系方式", score: contact },
  ];

  const words = bullets.join("").length + b.summary.length;
  return { total, dimensions, suggestions: dedupe(suggestions), keywords: { matched, missing }, stats: { bullets: bullets.length, words } };
}

const MODULE_NAMES: Record<string, string> = {
  experience: "工作经历",
  education: "教育经历",
  projects: "项目经历",
  skills: "技能",
  certs: "证书",
};

function dedupe(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = s.target + "|" + s.message.slice(0, 30);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
