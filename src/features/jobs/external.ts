import type { JobDto } from "./schema";
import { CITIES } from "@/shared/cities";

/**
 * 真实数据源集成（全部为官方公开接口或公开社区 API，无登录态、无爬虫）：
 * - 腾讯招聘官网（careers.tencent.com 官方前端接口）
 * - V2EX 酷工作节点（www.v2ex.com 官方 API）
 * - 电鸭社区（svc.eleduck.com 官方 API，远程工作为主）
 * - RemoteOK（官方开放 API，国际远程）
 * - Arbeitnow（官方开放 API，欧洲为主）
 *
 * 服务端运行时实时拉取 + 30 分钟内存缓存，归一化为 ExternalJob 供匹配引擎复用。
 * 注：BOSS直聘/智联/前程无忧/猎聘/拉勾无公开 API 且禁止抓取，国内其他公司职位
 * 请通过「添加职位」粘贴 JD 入库。
 */

export interface ExternalJob extends JobDto {
  url?: string;
  origin: string; // 腾讯官网 / V2EX酷工作 / 电鸭社区 / RemoteOK / Arbeitnow
}

interface CacheEntry {
  at: number;
  jobs: ExternalJob[];
}
const CACHE_TTL = 30 * 60 * 1000;
let cache: CacheEntry | null = null;
let inflight: Promise<ExternalJob[]> | null = null;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s{2,}/g, "\n")
    .trim();
}

/** 从自由文本中识别国内城市 */
function guessCity(text: string): string {
  for (const c of CITIES) {
    if (text.includes(c)) return c;
  }
  return "";
}

/** 从标签与描述中提取福利/工作方式标签（映射为中文标签） */
function extractBenefitTags(text: string, tags: string[]): string[] {
  const out: string[] = [];
  const all = (text + " " + tags.join(" ")).toLowerCase();
  const push = (t: string) => { if (!out.includes(t)) out.push(t); };
  if (/remote|work from home|distributed team|远程/.test(all)) push("远程办公");
  if (/visa|sponsorship|relocation/.test(all)) push("签证支持");
  if (/equity|stock option|shares|期权/.test(all)) push("股票期权");
  if (/401k|pension|insurance|social security|五险/.test(all)) push("保险福利");
  if (/flexible hours|flexible schedule|async|弹性/.test(all)) push("弹性工作");
  if (/paid time off|pto|vacation|annual leave|年假/.test(all)) push("带薪年假");
  if (/health|dental|medical/.test(all)) push("健康福利");
  if (/learning budget|education|training/.test(all)) push("学习基金");
  return out.slice(0, 8);
}

/* ---------------- 腾讯招聘官网 ---------------- */

interface TencentPost {
  RecruitPostName?: string;
  LocationName?: string;
  CategoryName?: string;
  BGName?: string;
  Responsibility?: string;
  RequireWorkYearsName?: string;
  PostURL?: string;
}

export function normalizeTencent(posts: TencentPost[]): ExternalJob[] {
  return posts.slice(0, 60).map((p) => {
    const jd = stripHtml(p.Responsibility ?? "");
    const city = p.LocationName?.split(",-")[0]?.trim() ?? "";
    const benefits = extractBenefitTags(jd, []);
    return {
      id: `ext:tx:${p.PostURL ?? p.RecruitPostName}`,
      channel: "官网",
      company: `腾讯${p.BGName ? ` · ${p.BGName}` : ""}`.slice(0, 80),
      role: String(p.RecruitPostName ?? "未命名职位").slice(0, 100),
      city: city || guessCity(jd) || "深圳",
      salaryText: "",
      salaryMinK: null,
      salaryMaxK: null,
      benefits: benefits.length ? benefits : ["大厂官方职位"],
      experienceReq: p.RequireWorkYearsName ?? "",
      educationReq: "",
      jdText: jd.slice(0, 4000),
      source: "external" as const,
      createdAt: new Date().toISOString(),
      url: p.PostURL,
      origin: "腾讯官网" as const,
    };
  });
}

/* ---------------- V2EX 酷工作 ---------------- */

interface V2exTopic {
  id: number;
  title: string;
  content: string;
  url: string;
}

export function normalizeV2ex(topics: V2exTopic[]): ExternalJob[] {
  return topics.slice(0, 40).map((t) => {
    const text = stripHtml(t.content ?? "");
    const title = t.title.slice(0, 100);
    const city = guessCity(title + " " + text);
    const salary = (title + " " + text).match(/\d{1,3}[kK]?\s*[-~至]\s*\d{1,3}[kK]?/)?.[0]?.trim() ?? "";
    return {
      id: `ext:v2ex:${t.id}`,
      channel: "其他",
      company: (title.match(/\[?([^\]／/｜|]{2,20})\]?/)?.[1] ?? "V2EX 发布方").slice(0, 40),
      role: title.replace(/^\[[^\]]*\]\s*/, "").slice(0, 60),
      city: city || "远程",
      salaryText: salary,
      salaryMinK: null,
      salaryMaxK: null,
      benefits: extractBenefitTags(text, []),
      experienceReq: "",
      educationReq: "",
      jdText: (title + "\n\n" + text).slice(0, 4000),
      source: "external" as const,
      createdAt: new Date().toISOString(),
      url: t.url,
      origin: "V2EX酷工作" as const,
    };
  });
}

/* ---------------- 电鸭社区（远程工作） ---------------- */

interface EleduckPost {
  id: string;
  title: string;
  summary?: string;
  published_at?: string;
}

export function normalizeEleduck(posts: EleduckPost[]): ExternalJob[] {
  return posts.slice(0, 30).map((p) => {
    const text = stripHtml(p.summary ?? "");
    return {
      id: `ext:duck:${p.id}`,
      channel: "其他",
      company: (p.title.match(/[｜|]\s*([^｜|]{2,20})/)?.[1] ?? "电鸭发布方").trim().slice(0, 40),
      role: p.title.split(/[｜|]/)[0]?.slice(0, 60) ?? "远程职位",
      city: guessCity(p.title + " " + text) || "远程",
      salaryText: (text.match(/\d{1,3}[kK]\s*[-~至]\s*\d{1,3}[kK]/)?.[0] ?? p.title.match(/\d{1,3}[kK]\s*[-~至]\s*\d{1,3}[kK]/)?.[0] ?? "").trim(),
      salaryMinK: null,
      salaryMaxK: null,
      benefits: ["远程办公"],
      experienceReq: "",
      educationReq: "",
      jdText: (p.title + "\n\n" + text).slice(0, 4000),
      source: "external" as const,
      createdAt: p.published_at ?? new Date().toISOString(),
      url: `https://eleduck.com/posts/${p.id}`,
      origin: "电鸭社区" as const,
    };
  });
}

/* ---------------- RemoteOK ---------------- */

interface RemoteOkRaw {
  slug?: string; id?: number; position?: string; company?: string; location?: string;
  tags?: string[]; salary_min?: number; salary_max?: number; url?: string; description?: string; date?: string;
}

export function normalizeRemoteOk(raw: RemoteOkRaw[]): ExternalJob[] {
  return raw
    .filter((j) => j.position && j.company)
    .slice(0, 50)
    .map((j) => {
      const tags = (j.tags ?? []).map((t) => String(t));
      const benefits = extractBenefitTags(j.description ?? "", tags);
      const salaryText =
        j.salary_min && j.salary_max ? `$${Math.round(j.salary_min / 1000)}K-$${Math.round(j.salary_max / 1000)}K/年` : "";
      return {
        id: `ext:rok:${j.slug ?? j.id}`,
        channel: "其他",
        company: String(j.company).slice(0, 80),
        role: String(j.position).slice(0, 100),
        city: j.location?.trim() ? String(j.location).slice(0, 40) : "Remote",
        salaryText,
        salaryMinK: null,
        salaryMaxK: null,
        benefits: benefits.length ? benefits : ["远程办公"],
        experienceReq: "",
        educationReq: "",
        jdText: (stripHtml(j.description ?? "") + "\n\n技能标签: " + tags.join(", ")).slice(0, 4000),
        source: "external" as const,
        createdAt: j.date ?? new Date().toISOString(),
        url: j.url ? `https://remoteok.com${j.url}` : "https://remoteok.com",
        origin: "RemoteOK" as const,
      };
    });
}

/* ---------------- Arbeitnow ---------------- */

interface ArbeitRaw {
  slug: string; company_name: string; title: string; location: string;
  job_types?: string[]; tags?: string[]; remote: boolean; url: string; description: string;
}

export function normalizeArbeit(raw: { data: ArbeitRaw[] }): ExternalJob[] {
  return raw.data.slice(0, 50).map((j) => {
    const tags = [...(j.tags ?? []), ...(j.job_types ?? [])].map(String);
    const benefits = extractBenefitTags(j.description ?? "", tags);
    return {
      id: `ext:arb:${j.slug}`,
      channel: "其他",
      company: String(j.company_name || "未知公司").slice(0, 80),
      role: String(j.title).slice(0, 100),
      city: j.location?.trim() ? String(j.location).slice(0, 40) : "Remote",
      salaryText: "",
      salaryMinK: null,
      salaryMaxK: null,
      benefits: j.remote ? ["远程办公", ...benefits.filter((b) => b !== "远程办公")] : benefits,
      experienceReq: tags.filter((t) => /senior|junior|lead|principal/i.test(t)).join("/") ?? "",
      educationReq: "",
      jdText: (stripHtml(j.description ?? "") + "\n\n技能标签: " + tags.join(", ")).slice(0, 4000),
      source: "external" as const,
      createdAt: new Date().toISOString(),
      url: j.url,
      origin: "Arbeitnow" as const,
    };
  });
}

/* ---------------- 统一拉取 ---------------- */

/** 拉取全部真实数据源（30 分钟缓存）；单源失败不影响其他源 */
export async function fetchExternalJobs(): Promise<ExternalJob[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.jobs;
  if (inflight) return inflight;

  inflight = (async () => {
    const UA = "ResumeForge/1.0 (job aggregator)";
    const settle = async (label: string, run: () => Promise<ExternalJob[]>): Promise<ExternalJob[]> => {
      try {
        return await run();
      } catch (err) {
        console.warn(`[external-jobs] ${label} 拉取失败:`, err instanceof Error ? err.message : err);
        return [];
      }
    };

    const [tencent, v2ex, duck, rok, arb] = await Promise.all([
      settle("腾讯官网", async () => {
        const res = await fetch(
          `https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now()}&pageIndex=1&pageSize=60&language=zh-cn`,
          { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(15000) },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        return normalizeTencent((body?.Data?.Posts ?? []) as TencentPost[]);
      }),
      settle("V2EX酷工作", async () => {
        const res = await fetch("https://www.v2ex.com/api/topics/show.json?node_name=jobs", {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return normalizeV2ex((await res.json()) as V2exTopic[]);
      }),
      settle("电鸭社区", async () => {
        const res = await fetch("https://svc.eleduck.com/api/v1/posts?category=5&page=1&size=30", {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        return normalizeEleduck(((body?.posts ?? []) as EleduckPost[]));
      }),
      settle("RemoteOK", async () => {
        const res = await fetch("https://remoteok.com/api", {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return normalizeRemoteOk((await res.json()) as RemoteOkRaw[]);
      }),
      settle("Arbeitnow", async () => {
        const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return normalizeArbeit((await res.json()) as { data: ArbeitRaw[] });
      }),
    ]);

    const jobs = [...tencent, ...v2ex, ...duck, ...rok, ...arb];
    cache = { at: Date.now(), jobs };
    return jobs;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
