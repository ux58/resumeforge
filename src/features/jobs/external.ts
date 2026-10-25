import type { JobDto } from "./schema";

/**
 * 真实数据源集成：RemoteOK / Arbeitnow 官方开放 API（免费、无需密钥、允许聚合展示）。
 * 服务端运行时实时拉取 + 30 分钟内存缓存，归一化为 JobDto 形态供匹配引擎复用。
 * 国内主流平台（BOSS直聘/智联等）无公开 API 且禁止抓取，真实国内职位请用"添加职位"粘贴 JD 入库。
 */

export interface ExternalJob extends JobDto {
  url?: string;
  origin: "RemoteOK" | "Arbeitnow";
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

/** 从标签与描述中提取福利/工作方式标签（映射为中文标签） */
function extractBenefitTags(text: string, tags: string[]): string[] {
  const out: string[] = [];
  const all = (text + " " + tags.join(" ")).toLowerCase();
  const push = (t: string) => { if (!out.includes(t)) out.push(t); };
  if (/remote|work from home|distributed team/.test(all)) push("远程办公");
  if (/visa|sponsorship|relocation/.test(all)) push("签证支持");
  if (/equity|stock option|shares/.test(all)) push("股票期权");
  if (/401k|pension|insurance|social security/.test(all)) push("保险福利");
  if (/flexible hours|flexible schedule|async/.test(all)) push("弹性工作");
  if (/paid time off|pto|vacation|annual leave/.test(all)) push("带薪年假");
  if (/health|dental|medical/.test(all)) push("健康福利");
  if (/learning budget|education|training/.test(all)) push("学习基金");
  for (const t of tags) {
    if (/^remote$/i.test(t)) push("远程办公");
    else if (/^visa$/i.test(t)) push("签证支持");
  }
  return out.slice(0, 8);
}

interface RemoteOkRaw {
  slug?: string; id?: number; position?: string; company?: string; location?: string;
  tags?: string[]; salary_min?: number; salary_max?: number; url?: string; description?: string; date?: string;
}

function normalizeRemoteOk(raw: RemoteOkRaw[]): ExternalJob[] {
  return raw
    .filter((j) => j.position && j.company)
    .slice(0, 60)
    .map((j) => {
      const tags = (j.tags ?? []).map((t) => String(t));
      const benefits = extractBenefitTags(j.description ?? "", tags);
      const salaryText =
        j.salary_min && j.salary_max ? `$${Math.round(j.salary_min / 1000)}K-$${Math.round(j.salary_max / 1000)}K/年` : "";
      return {
        id: `ext:rok:${j.slug ?? j.id}`,
        channel: "RemoteOK",
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

interface ArbeitRaw {
  slug: string; company_name: string; title: string; location: string;
  job_types?: string[]; tags?: string[]; remote: boolean; url: string; description: string;
}

function normalizeArbeit(raw: { data: ArbeitRaw[] }): ExternalJob[] {
  return raw.data
    .slice(0, 60)
    .map((j) => {
      const tags = [...(j.tags ?? []), ...(j.job_types ?? [])].map(String);
      const benefits = extractBenefitTags(j.description ?? "", tags);
      return {
        id: `ext:arb:${j.slug}`,
        channel: "Arbeitnow",
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

/** 拉取真实外部职位（30 分钟缓存）；单源失败不影响另一源 */
export async function fetchExternalJobs(): Promise<ExternalJob[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.jobs;
  if (inflight) return inflight;

  inflight = (async () => {
    const settle = async (label: string, url: string, normalize: (raw: unknown) => ExternalJob[]) => {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "ResumeForge/1.0 (job aggregator)" }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return normalize(await res.json());
      } catch (err) {
        console.warn(`[external-jobs] ${label} 拉取失败:`, err instanceof Error ? err.message : err);
        return [];
      }
    };
    const [rok, arb] = await Promise.all([
      settle("RemoteOK", "https://remoteok.com/api", (raw) => normalizeRemoteOk(raw as RemoteOkRaw[])),
      settle("Arbeitnow", "https://www.arbeitnow.com/api/job-board-api", (raw) => normalizeArbeit(raw as { data: ArbeitRaw[] })),
    ]);
    const jobs = [...rok, ...arb];
    cache = { at: Date.now(), jobs };
    return jobs;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
