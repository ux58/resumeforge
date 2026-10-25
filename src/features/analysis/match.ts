import type { ResumeData } from "@/features/resumes/schema";
import type { JobDto } from "@/features/jobs/schema";

/**
 * 职位匹配引擎：简历 × 职位（JD）→ 匹配分 + 优先级分级 + 指导建议。
 * 与 analyzeResume 共享中文滑窗 + 英文单词分词口径。
 */

export interface JobMatch {
  jobId: string;
  score: number; // 0-100
  grade: "S" | "A" | "B" | "C";
  gradeLabel: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  cityMatch: "same" | "remote-ok" | "unknown" | "diff";
  guidance: string[];
}

const STOP_EN = new Set(["the", "and", "for", "with", "you", "our", "will", "are", "have", "has", "this", "that", "from", "job", "work", "team", "role", "who", "what", "your"]);
const STOP_CN = new Set([
  // 通用结构词
  "我们", "一个", "以及", "或者", "通过", "进行", "相关", "以上", "能够", "优先", "负责", "工作", "具备", "具有", "良好", "较强", "公司", "岗位", "要求", "职责", "任职", "描述", "加分", "熟悉者优先", "以下", "包括",
  // JD 样板词与福利词（福利已在标签维度单独展示）
  "岗位职责", "任职要求", "福利", "薪资", "月薪", "年薪", "双休", "大小周", "弹性工作", "五险一金", "六险一金", "远程办公", "年终奖", "带薪年假", "加班补贴", "定期体检", "免费班车", "住房补贴", "交通补贴",
  // 动词与经验句式（动词已有行动维度，经验年限单独评分）
  "主导", "参与", "精通", "熟悉", "了解", "掌握", "年以上", "经验", "优先考虑", "加分项", "建设", "落地", "体系",
]);

/** 从 JD 提取关键词（英文原样保留 + 纯中文 2-6 字滑窗），并按出现频次排序 */
export function extractJdKeywords(jd: string): string[] {
  const freq = new Map<string, number>();
  const bump = (t: string) => freq.set(t, (freq.get(t) ?? 0) + 1);

  const enWords = jd.match(/[a-zA-Z][a-zA-Z0-9+#.\-]{1,20}/g) ?? [];
  for (const w of enWords) {
    if (STOP_EN.has(w.toLowerCase())) continue;
    bump(w);
  }
  const segments = jd.split(/[，。、；！？：\s（）()【】\[\]"“”'']/).filter((s) => s.length >= 2);
  for (const rawSeg of segments) {
    for (const seg of rawSeg.split(/[a-zA-Z0-9+#.\-/]+/)) {
      if (/^[\u4e00-\u9fff]{2,}$/.test(seg)) bump(seg); // 每个短语一个关键词；容错在 hit() 判定里做
    }
  }
  return [...freq.entries()]
    .filter(([t]) => t.length >= 2 && !STOP_CN.has(t))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([t]) => t);
}

function resumeCorpus(resume: ResumeData): string {
  return JSON.stringify({
    basics: resume.basics,
    education: resume.education,
    experience: resume.experience,
    projects: resume.projects,
    skills: resume.skills,
    certs: resume.certs,
    customs: resume.customs,
  }).toLowerCase();
}

/** 关键词命中判定：整词命中，或纯中文 ≥4 字词的任意 4 字子串命中（容忍语序差异） */
function keywordHit(keyword: string, corpus: string): boolean {
  const k = keyword.toLowerCase();
  if (corpus.includes(k)) return true;
  if (/^[\u4e00-\u9fff]{4,}$/.test(k)) {
    for (let i = 0; i + 4 <= k.length; i++) {
      if (corpus.includes(k.slice(i, i + 4))) return true;
    }
  }
  return false;
}

export function gradeOf(score: number): { grade: JobMatch["grade"]; gradeLabel: string } {
  if (score >= 85) return { grade: "S", gradeLabel: "强烈推荐投递" };
  if (score >= 70) return { grade: "A", gradeLabel: "推荐投递" };
  if (score >= 55) return { grade: "B", gradeLabel: "可以一试" };
  return { grade: "C", gradeLabel: "匹配度较低" };
}

export function matchJob(resume: ResumeData, job: Pick<JobDto, "id" | "city" | "benefits" | "jdText">): JobMatch {
  const corpus = resumeCorpus(resume);
  const keywords = extractJdKeywords(job.jdText).slice(0, 40);
  const matchedKeywords = keywords.filter((k) => keywordHit(k, corpus));
  const missingKeywords = keywords.filter((k) => !keywordHit(k, corpus));

  // 覆盖度：关键词命中占比（JD 高频词已按频次排序，取前 40 个）
  const coverage = keywords.length ? matchedKeywords.length / keywords.length : 0;

  // 技能标签命中（简历 skills 与 JD 文本对照）
  const skillHit = resume.skills.filter((s) => job.jdText.toLowerCase().includes(s.name.toLowerCase())).length;
  const skillRatio = resume.skills.length ? skillHit / resume.skills.length : 0;

  // 城市：同城 / 职位远程且简历可远程 / 简历未填城市视为未知
  let cityMatch: JobMatch["cityMatch"] = "unknown";
  if (job.city === "远程") cityMatch = "remote-ok";
  else if (resume.basics.location && job.city && resume.basics.location.includes(job.city)) cityMatch = "same";
  else if (job.city && resume.basics.location && !resume.basics.location.includes(job.city)) cityMatch = "diff";
  const cityScore = cityMatch === "same" ? 1 : cityMatch === "remote-ok" ? 0.9 : cityMatch === "unknown" ? 0.6 : 0.2;

  // 经验年限：从简历文本提取「N 年」与职位要求对照
  const yearsMatch = JSON.stringify(resume.experience).match(/(\d{1,2})\s*年/);
  const resumeYears = yearsMatch ? parseInt(yearsMatch[1], 10) : null;
  const reqYears = job.jdText.match(/(\d)[-–~到]\s*\d?\s*年|(\d)\s*年以[上内]/);
  const reqMin = reqYears ? parseInt(reqYears[1] ?? reqYears[2] ?? "0", 10) : null;
  const expScore = resumeYears == null || reqMin == null ? 0.6 : resumeYears >= reqMin ? 1 : Math.max(0.2, resumeYears / reqMin);

  const score = Math.round(
    coverage * 55 + skillRatio * 20 + cityScore * 10 + expScore * 15,
  );

  const { grade, gradeLabel } = gradeOf(score);

  // ---------- 指导建议 ----------
  const guidance: string[] = [];
  if (missingKeywords.length) {
    guidance.push(`补齐关键词：JD 中出现但简历未覆盖——${missingKeywords.slice(0, 5).join("、")}。若有相关经验，补进对应条目可直接提升 ATS 通过率`);
  }
  if (skillRatio < 1 && resume.skills.length) {
    const unmatched = resume.skills.filter((s) => !job.jdText.toLowerCase().includes(s.name.toLowerCase())).map((s) => s.name);
    if (unmatched.length) guidance.push(`技能对齐：${unmatched.slice(0, 4).join("、")} 在该 JD 中未提及，投递时可在总结中重新组织表述以贴合岗位语言`);
  }
  if (cityMatch === "diff") {
    guidance.push(`地点提醒：职位在${job.city}，简历所在地为${resume.basics.location}。若可接受搬迁/出差，建议在总结中注明到岗意愿`);
  }
  if (reqMin != null && resumeYears != null && resumeYears < reqMin) {
    guidance.push(`经验差距：职位要求 ${reqMin} 年以上，简历体现约 ${resumeYears} 年。用实习/个人项目/开源贡献补充经验证据`);
  }
  if (coverage > 0.6 && missingKeywords.length <= 3) {
    guidance.push("该职位与简历高度契合，建议在投递附言中直接点名 JD 里的核心要求，进一步提高回复率");
  }
  const benefitNote = job.benefits.length ? `福利标签：${job.benefits.join(" / ")}` : "";
  if (benefitNote) guidance.push(benefitNote);

  return {
    jobId: job.id,
    score,
    grade,
    gradeLabel,
    matchedKeywords: matchedKeywords.slice(0, 16),
    missingKeywords: missingKeywords.slice(0, 10),
    cityMatch,
    guidance,
  };
}

export interface JobFilter {
  /** 城市包含匹配（空 = 不限） */
  city?: string;
  /** 必须包含的福利标签（全部满足） */
  benefits?: string[];
  /** 月薪下限（K），任一端 ≥ 该值即符合 */
  salaryMinK?: number;
  /** 仅看双休 */
  weekendOnly?: boolean;
  /** 仅看远程 */
  remoteOnly?: boolean;
}

export function filterJobs(jobs: JobDto[], f: JobFilter): JobDto[] {
  return jobs.filter((j) => {
    if (f.city && !j.city.includes(f.city)) return false;
    if (f.benefits?.length && !f.benefits.every((b) => j.benefits.includes(b))) return false;
    if (f.weekendOnly && !j.benefits.includes("双休")) return false;
    if (f.remoteOnly && !j.benefits.includes("远程办公") && j.city !== "远程") return false;
    if (f.salaryMinK != null && (j.salaryMaxK ?? j.salaryMinK ?? 0) < f.salaryMinK) return false;
    return true;
  });
}
