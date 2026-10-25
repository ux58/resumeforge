import type { ResumeData } from "@/features/resumes/schema";
import { EMPTY_RESUME } from "@/features/resumes/schema";

/**
 * 简历文本导入：对粘贴的纯文本简历做启发式解析（尽力而为，解析结果进表单供人工核对）。
 * 不追求完美——解析不了的内容保留在「导入原文」里由用户手动安置。
 */

export interface ImportResult {
  data: ResumeData;
  warnings: string[];
}

const SECTION_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: "basics", re: /^(基本信息|个人信息|联系方式|个人简介)\s*[:：]?\s*$/ },
  { key: "summary", re: /^(个人总结|自我评价|个人简介|关于我|个人优势)\s*[:：]?\s*$/ },
  { key: "experience", re: /^(工作经历|职业经历|从业经历|实习经历)\s*[:：]?\s*$/ },
  { key: "projects", re: /^(项目经历|项目经验)\s*[:：]?\s*$/ },
  { key: "education", re: /^(教育经历|教育背景)\s*[:：]?\s*$/ },
  { key: "skills", re: /^(专业技能|技能特长|技能|IT技能|核心技能)\s*[:：]?\s*$/ },
  { key: "certs", re: /^(证书|资格证书|证书奖项|荣誉证书)\s*[:：]?\s*$/ },
];

function isSectionHead(line: string): string | null {
  const t = line.trim();
  if (t.length > 16) return null;
  for (const p of SECTION_PATTERNS) {
    if (p.re.test(t)) return p.key;
  }
  return null;
}

export function parseResumeText(raw: string): ImportResult {
  const warnings: string[] = [];
  const data: ResumeData = JSON.parse(JSON.stringify(EMPTY_RESUME));
  const lines = raw.split(/\r?\n/);
  const text = raw;

  // ---------- 基本信息 ----------
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) data.basics.email = email[0];
  else warnings.push("未识别到邮箱");

  const phone = text.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}|\d{3}-\d{7,8}/);
  if (phone) data.basics.phone = phone[0];

  // 姓名：优先「姓名：X」，否则取第一行 2-4 个纯中文字符的短行
  const nameField = text.match(/姓名\s*[:：]\s*([\u4e00-\u9fff]{2,4})/);
  if (nameField) data.basics.name = nameField[1];
  else {
    const firstShort = lines.map((l) => l.trim()).find((l) => /^[\u4e00-\u9fff]{2,4}$/.test(l));
    if (firstShort) data.basics.name = firstShort;
    else warnings.push("未识别到姓名，请手动填写");
  }

  // 求职意向
  const intent = text.match(/(?:求职意向|应聘岗位|求职岗位)\s*[:：]\s*(.{2,60})/);
  if (intent) data.basics.headline = intent[1].trim();
  const city = text.match(/(?:所在城市|现居|坐标|城市)\s*[:：]\s*(.{2,20})/);
  if (city) data.basics.location = city[1].trim();

  // ---------- 分节 ----------
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines) {
    const head = isSectionHead(line);
    if (head) {
      current = head;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
  }
  if (!sections.size) {
    warnings.push("未识别到标准分节标题（工作经历/教育经历/技能…），已将全文存入个人总结供手动拆分");
    data.basics.summary = text.slice(0, 780);
    return { data, warnings };
  }

  // ---------- 个人总结 ----------
  const summaryLines = (sections.get("summary") ?? []).join(" ").trim();
  if (summaryLines) data.basics.summary = summaryLines.slice(0, 780);

  // ---------- 工作经历：公司行含日期区间，后续行为要点 ----------
  const expLines = sections.get("experience") ?? [];
  let cur: { company: string; role: string; start: string; end: string; bullets: string[] } | null = null;
  const flushExp = () => {
    if (cur) data.experience.push({ ...cur, bullets: cur.bullets.join("\n") });
  };
  for (const line of expLines) {
    const t = line.trim();
    if (!t) continue;
    const dateRange = t.match(/((?:19|20)\d{2}(?:[.\-/年]\d{1,2})?)\s*[-–—~至到]\s*((?:(?:19|20)\d{2}(?:[.\-/年]\d{1,2})?)|至今|现在)?/);
    const hasDate = !!dateRange && /(?:19|20)\d{2}/.test(t);
    if (hasDate) {
      flushExp();
      const company = t.replace(dateRange[0], "").replace(/[|｜·—–\-–]/g, " ").replace(/\s{2,}/g, " ").trim();
      const segs = company.split(/\s+/).filter(Boolean);
      cur = {
        company: segs[0] ?? "",
        role: segs.slice(1).join(" ") || (segs.length === 1 ? "" : ""),
        start: (dateRange[1] ?? "").replace(/年$/, ""),
        end: (dateRange[2] ?? "").replace(/年$/, "") === "至今" || dateRange[2] === undefined && /至今|现在/.test(t) ? "至今" : (dateRange[2] ?? "").replace(/年$/, ""),
        bullets: [],
      };
      if (/至今|现在/.test(t)) cur.end = "至今";
    } else if (cur) {
      cur.bullets.push(t.replace(/^[-•·*\d.、\s]+/, ""));
    }
  }
  flushExp();
  if (!data.experience.length && expLines.length) warnings.push("工作经历未能按日期区间拆分，原文保留在导入原文中");

  // ---------- 项目经历：同策略（名称行 + 描述） ----------
  const projLines = sections.get("projects") ?? [];
  let curProj: { name: string; role: string; tech: string; link: string; desc: string[] } | null = null;
  for (const line of projLines) {
    const t = line.trim();
    if (!t) continue;
    const isHead = /^[•\-–]|^项目名|[:：]/.test(t) === false && t.length <= 40 && !/^(项目描述|项目介绍|负责|主导|参与)/.test(t);
    if (isHead && !curProj) {
      curProj = { name: t.replace(/^项目[:：]/, ""), role: "", tech: "", link: "", desc: [] };
    } else if (curProj) {
      curProj.desc.push(t.replace(/^[-•·*\d.、\s]+/, ""));
    } else {
      // 没有明确标题：整体放第一条项目
      curProj = { name: "项目 " + (data.projects.length + 1), role: "", tech: "", link: "", desc: [] };
      curProj.desc.push(t.replace(/^[-•·*\d.、\s]+/, ""));
    }
  }
  if (curProj) data.projects.push({ ...curProj, desc: curProj.desc.join("\n") });

  // ---------- 教育：学校行含时间/学历 ----------
  const eduLines = sections.get("education") ?? [];
  for (const line of eduLines) {
    const t = line.trim();
    if (!t) continue;
    const school = t.match(/([\u4e00-\u9fff]{2,16}(?:大学|学院|学校))/);
    const degree = t.match(/(博士|硕士|研究生|本科|大专|专科|高中)/);
    if (school || degree) {
      const dateRange = t.match(/((?:19|20)\d{2})\s*[-–—~至到]\s*((?:19|20)\d{2}|至今)?/);
      data.education.push({
        school: school?.[1] ?? "",
        degree: degree?.[1] ?? "",
        field: "",
        start: dateRange?.[1] ?? "",
        end: dateRange?.[2] ?? "",
        desc: t,
      });
    }
  }

  // ---------- 技能：顿号/逗号分隔 ----------
  const skillLines = sections.get("skills") ?? [];
  const skillText = skillLines.join(" ");
  const tokens = skillText.split(/[、,，;；/|·\n]+/).map((s) => s.trim()).filter((s) => s.length >= 1 && s.length <= 20);
  for (const t of tokens) {
    if (data.skills.length >= 40) break;
    const m = t.match(/^(.{1,30}?)[（(]((?:了解|熟悉|掌握|精通|专家))[)）]$/);
    if (m) {
      const level = { 了解: 2, 熟悉: 3, 掌握: 4, 精通: 5, 专家: 5 }[m[2]] ?? 3;
      data.skills.push({ name: m[1].trim(), level });
    } else if (t) {
      data.skills.push({ name: t.replace(/^\d+[.、]\s*/, ""), level: 3 });
    }
  }

  // ---------- 证书 ----------
  const certLines = sections.get("certs") ?? [];
  for (const line of certLines) {
    const t = line.trim().replace(/^[-•·*\d.、\s]+/, "");
    if (t) data.certs.push({ name: t.slice(0, 120), issuer: "", date: "" });
  }

  // ---------- 未安置的段落提示 ----------
  const known = new Set(["basics", "summary", "experience", "projects", "education", "skills", "certs"]);
  for (const key of sections.keys()) {
    if (!known.has(key as string)) warnings.push(`段落「${key}」未自动归类，请在编辑器中手动安置`);
  }

  return { data, warnings };
}
