"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, ExternalLink, MapPin, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { toast } from "@/components/toast";
import { Select } from "@/components/select";
import { ScrollArea } from "@/components/scroll-area";
import { extractJobFromText, KNOWN_BENEFITS, type JobDto } from "@/features/jobs/schema";
import type { JobCreateInput } from "@/features/jobs/schema";
import type { ExternalJob } from "@/features/jobs/external";
import { filterJobs, matchJob, type JobFilter, type JobMatch } from "@/features/analysis/match";
import type { ResumeDto } from "@/features/resumes/service";
import { CHANNELS, CITIES } from "@/shared/cities";
import { JOB_CATEGORIES, classifyJobCategory } from "@/features/jobs/category";
import styles from "./jobs.module.scss";

const GRADE_STYLE: Record<JobMatch["grade"], string> = { S: styles.gradeS, A: styles.gradeA, B: styles.gradeB, C: styles.gradeC };
const QUICK_BENEFITS = ["双休", "五险一金", "远程办公", "弹性工作", "年终奖"];

type SourceTab = "library" | "external";

export function JobsClient({ resumes }: { resumes: ResumeDto[] }) {
  const [jobs, setJobs] = useState<JobDto[] | null>(null);
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [filters, setFilters] = useState<JobFilter>({ benefits: [], weekendOnly: false, remoteOnly: false });
  const [city, setCity] = useState("");
  const [channel, setChannel] = useState("");
  const [category, setCategory] = useState("");
  const [salary, setSalary] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceTab>("library");
  const [external, setExternal] = useState<ExternalJob[] | null>(null);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    apiJson<{ items: JobDto[] }>("/api/jobs")
      .then((r) => setJobs(r.items))
      .catch(() => setJobs([]));
  }, []);

  const resume = resumes.find((r) => r.id === resumeId) ?? resumes[0];

  async function loadExternal() {
    if (external !== null || extLoading) return;
    setExtLoading(true);
    try {
      const r = await apiJson<{ items: ExternalJob[] }>("/api/jobs/external");
      setExternal(r.items);
    } catch {
      setExtError(true);
      setExternal([]);
    } finally {
      setExtLoading(false);
    }
  }

  useEffect(() => {
    if (sourceTab !== "external") return;
    const id = requestAnimationFrame(() => void loadExternal());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceTab]);

  async function refresh() {
    setRefreshing(true);
    try {
      if (sourceTab === "external") {
        const r = await apiJson<{ items: ExternalJob[] }>("/api/jobs/external");
        setExternal(r.items);
      } else {
        const r = await apiJson<{ items: JobDto[] }>("/api/jobs");
        setJobs(r.items);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function removeJob(id: string) {
    if (!confirm("删除这个职位？")) return;
    try {
      await apiJson(`/api/jobs/${id}`, { method: "DELETE" });
      setJobs((prev) => (prev ?? []).filter((j) => j.id !== id));
      toast.ok("已删除");
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "删除失败");
    }
  }

  /** 外部真实数据筛选取决于城市/福利/远程/薪资（含中英城市等价） */
  const isRemoteCity = (c: string) => c === "远程" || c === "Remote";
  const filterExternal = (list: ExternalJob[]): ExternalJob[] =>
    list
      .filter((j) => !city || j.city.includes(city) || (city === "远程" && (isRemoteCity(j.city) || j.benefits.includes("远程办公"))))
      .filter((j) => !(filters.benefits?.length) || filters.benefits.every((b) => j.benefits.includes(b)))
      .filter((j) => !filters.weekendOnly || j.benefits.includes("双休"))
      .filter((j) => !filters.remoteOnly || isRemoteCity(j.city) || j.benefits.includes("远程办公"))
      .filter((j) => salary == null || ((j.salaryMaxK ?? j.salaryMinK) != null && (j.salaryMaxK ?? j.salaryMinK ?? 0) >= salary))
      .filter((j) => !category || classifyJobCategory(j.role, j.jdText) === category);

  const matches = useMemo(() => {
    if (!resume) return [];
    if (sourceTab === "external") {
      if (!external) return [];
      return filterExternal(external)
        .map((j) => ({ job: j, match: matchJob(resume.data, j) }))
        .sort((a, b) => b.match.score - a.match.score);
    }
    if (!jobs) return [];
    const filtered = filterJobs(jobs, { ...filters, city: city || undefined, salaryMinK: salary ?? undefined }).filter((j) => (channel ? j.channel === channel : true))
    .filter((j) => !category || classifyJobCategory(j.role, j.jdText) === category);
    return filtered
      .map((j) => ({ job: j, match: matchJob(resume.data, j) }))
      .sort((a, b) => b.match.score - a.match.score);
    // filterExternal 闭包仅依赖 filters/city/salary，均已列入 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceTab, jobs, external, resume, filters, city, channel, category, salary]);

  const cities = useMemo(() => [...CITIES], []);

  if (!resumes.length) {
    return (
      <div className={`${styles.empty} card page-container`}>
        <Briefcase size={30} strokeWidth={1.6} />
        <p>先创建一份简历，再回到这里做职位匹配分析。</p>
        <Link href="/dashboard" className="btn primary">去创建简历</Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className={styles.head}>
        <div>
          <h1>职位匹配中心</h1>
          <p className={styles.sub}>
            {sourceTab === "library"
              ? "粘贴任意招聘平台的 JD 即可入库分析；按匹配度分级（S/A/B/C），福利标签一目了然"
              : "真实在招岗位——腾讯官网 / V2EX酷工作 / 电鸭社区 / RemoteOK / Arbeitnow 五源实时拉取（30 分钟缓存），单源故障不影响其余"}
          </p>
        </div>
        <div className={styles.headOps}>
          <Select
            value={resumeId}
            onChange={setResumeId}
            ariaLabel="选择用于匹配的简历"
            className={styles.resumeSelect}
            options={resumes.map((r) => ({ value: r.id, label: r.title + "（" + (r.data.basics.name || "未命名") + "）" }))}
          />
          <button className="btn" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? styles.spin : ""} /> 刷新
          </button>
          {sourceTab === "library" && (
            <button className="btn primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} strokeWidth={2.4} /> 添加职位
            </button>
          )}
        </div>
      </div>

      <div className={styles.sourceTabs} role="tablist">
        <button role="tab" aria-selected={sourceTab === "library"} className={`${styles.tabBtn} ${sourceTab === "library" ? styles.tabOn : ""}`} onClick={() => setSourceTab("library")}>
          职位库（自建/导入）
        </button>
        <button role="tab" aria-selected={sourceTab === "external"} className={`${styles.tabBtn} ${sourceTab === "external" ? styles.tabOn : ""}`} onClick={() => setSourceTab("external")}>
          真实数据源（国内官网+社区+国际）
        </button>
      </div>

      <div className={styles.filterBar}>
        <Select
          value={city}
          onChange={setCity}
          ariaLabel="城市筛选"
          options={[{ value: "", label: "全部城市" }, ...cities.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          value={category}
          onChange={setCategory}
          ariaLabel="岗位类别筛选"
          options={[{ value: "", label: "全部岗位" }, ...JOB_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        {sourceTab === "library" && (
          <Select
            value={channel}
            onChange={setChannel}
            ariaLabel="渠道筛选"
            options={[{ value: "", label: "全部渠道" }, ...CHANNELS.map((c) => ({ value: c, label: c }))]}
          />
        )}
        <Select
          value={salary == null ? "" : String(salary)}
          onChange={(v) => setSalary(v ? Number(v) : null)}
          ariaLabel="月薪下限筛选"
          options={[{ value: "", label: "月薪不限" }, ...[15, 20, 25, 30, 40, 50].map((k) => ({ value: String(k), label: k + "K 以上" }))]}
        />
        {QUICK_BENEFITS.map((b) => (
          <button
            key={b}
            className={`${styles.filterTag} ${filters.benefits?.includes(b) ? styles.filterOn : ""}`}
            onClick={() =>
              setFilters((f) => {
                const cur = f.benefits ?? [];
                return { ...f, benefits: cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b] };
              })
            }
          >
            {b}
          </button>
        ))}
        <button
          className={`${styles.filterTag} ${filters.weekendOnly ? styles.filterOn : ""}`}
          onClick={() => setFilters((f) => ({ ...f, weekendOnly: !f.weekendOnly }))}
        >
          仅看双休
        </button>
        <button
          className={`${styles.filterTag} ${filters.remoteOnly ? styles.filterOn : ""}`}
          onClick={() => setFilters((f) => ({ ...f, remoteOnly: !f.remoteOnly }))}
        >
          仅看远程
        </button>
        {(filters.benefits?.length || filters.weekendOnly || filters.remoteOnly || city || category || (sourceTab === "library" && channel) || salary != null) ? (
          <button
            className={styles.clearBtn}
            onClick={() => { setFilters({ benefits: [] }); setCity(""); setChannel(""); setCategory(""); setSalary(null); }}
          >
            <X size={13} /> 清除筛选
          </button>
        ) : null}
      </div>

      {sourceTab === "external" ? (
        extLoading ? (
          <p className={styles.loading}>正在拉取真实岗位数据（RemoteOK / Arbeitnow 官方接口）…</p>
        ) : extError ? (
          <div className={`${styles.empty} card`}><p>真实数据源拉取失败，请稍后重试。</p></div>
        ) : matches.length === 0 ? (
          <div className={`${styles.empty} card`}><p>暂无匹配的外部职位，调整简历或稍后刷新。</p></div>
        ) : (
          <div className={styles.list}>
            {matches.map(({ job, match }) => (
              <ExternalCard key={job.id} job={job as ExternalJob} match={match} resumeId={resumeId} />
            ))}
          </div>
        )
      ) : jobs === null ? (
        <p className={styles.loading}>加载中…</p>
      ) : matches.length === 0 ? (
        <div className={`${styles.empty} card`}>
          <p>没有符合条件的职位。调整筛选，或点「添加职位」粘贴新的 JD。</p>
        </div>
      ) : (
        <div className={styles.list}>
          {matches.map(({ job, match }) => (
            <JobCard key={job.id} job={job as JobDto} match={match} onDelete={removeJob} resumeId={resumeId} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddJobDialog
          onClose={() => setShowAdd(false)}
          onAdded={(j) => {
            setJobs((prev) => [j, ...(prev ?? [])]);
            setShowAdd(false);
            toast.ok("职位已入库");
          }}
        />
      )}
    </div>
  );
}

function MatchDetail({ match }: { match: JobMatch }) {
  return (
    <div className={styles.detail}>
      {match.guidance.length > 0 && (
        <ul className={styles.guidance}>
          {match.guidance.map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      )}
      {match.missingKeywords.length > 0 && (
        <div className={styles.kwBlock}>
          <span className={styles.kwLabel}>缺失：</span>
          {match.missingKeywords.map((k) => <span key={k} className={styles.kwMiss}>{k}</span>)}
        </div>
      )}
      {match.matchedKeywords.length > 0 && (
        <div className={styles.kwBlock}>
          <span className={styles.kwLabel}>已覆盖：</span>
          {match.matchedKeywords.map((k) => <span key={k} className={styles.kwHit}>{k}</span>)}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, match, onDelete, resumeId }: { job: JobDto; match: JobMatch; onDelete: (id: string) => void; resumeId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`${styles.jobCard} card`}>
      <div className={styles.jobHead}>
        <span className={`${styles.grade} ${GRADE_STYLE[match.grade]}`}>{match.grade}</span>
        <div className={styles.jobTitle}>
          <strong>{job.role || "未命名职位"}</strong>
          <span className={styles.company}>
            {job.company}
            <span className={styles.channelTag}>{job.channel}</span>
          </span>
        </div>
        <div className={styles.jobMeta}>
          <span className={styles.salary}>{job.salaryText || "薪资面议"}</span>
          <span><MapPin size={12} /> {job.city || "不限"}</span>
          <span className={styles.matchScore}>{match.score} 分</span>
        </div>
      </div>

      <div className={styles.tagRow}>
        {job.benefits.map((b) => (
          <span key={b} className={styles.benefitTag}>{b}</span>
        ))}
        <span className={styles.catTag}>{classifyJobCategory(job.role, job.jdText)}</span>
        {job.experienceReq && <span className={styles.reqTag}>{job.experienceReq}</span>}
        {job.educationReq && <span className={styles.reqTag}>{job.educationReq}</span>}
      </div>

      <div className={styles.gradeLine}>
        <b>{match.gradeLabel}</b>
        <span>关键词命中 {match.matchedKeywords.length} · 缺失 {match.missingKeywords.length}</span>
      </div>

      <div className={styles.jobOps}>
        <button className="btn" onClick={() => setOpen((v) => !v)}>{open ? "收起详情" : "匹配详情与建议"}</button>
        <Link className="btn" href={`/editor/${resumeId}`}>去优化简历</Link>
        <button className="btn danger" onClick={() => onDelete(job.id)} aria-label={`删除 ${job.company} ${job.role}`}><Trash2 size={13} /></button>
      </div>

      {open && (
        <div className={styles.detail}>
          <MatchDetail match={match} />
          <details className={styles.jdDetails}>
            <summary>查看完整 JD</summary>
            <ScrollArea className={styles.jdScroll} ariaLabel="JD 全文"><pre className={styles.jdText}>{job.jdText}</pre></ScrollArea>
          </details>
        </div>
      )}
    </article>
  );
}

function ExternalCard({ job, match, resumeId }: { job: ExternalJob; match: JobMatch; resumeId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`${styles.jobCard} card`}>
      <div className={styles.jobHead}>
        <span className={`${styles.grade} ${GRADE_STYLE[match.grade]}`}>{match.grade}</span>
        <div className={styles.jobTitle}>
          <strong>{job.role || "未命名职位"}</strong>
          <span className={styles.company}>
            {job.company}
            <span className={styles.realTag}>真实数据 · {job.origin}</span>
          </span>
        </div>
        <div className={styles.jobMeta}>
          {job.salaryText && <span className={styles.salary}>{job.salaryText}</span>}
          <span><MapPin size={12} /> {job.city || "Remote"}</span>
          <span className={styles.matchScore}>{match.score} 分</span>
        </div>
      </div>

      <div className={styles.tagRow}>
        <span className={styles.catTag}>{classifyJobCategory(job.role, job.jdText)}</span>
        {job.benefits.map((b) => (
          <span key={b} className={styles.benefitTag}>{b}</span>
        ))}
      </div>

      <div className={styles.gradeLine}>
        <b>{match.gradeLabel}</b>
        <span>关键词命中 {match.matchedKeywords.length} · 缺失 {match.missingKeywords.length}</span>
      </div>

      <div className={styles.jobOps}>
        <button className="btn" onClick={() => setOpen((v) => !v)}>{open ? "收起详情" : "匹配详情与建议"}</button>
        {job.url && (
          <a className="btn" href={job.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={13} /> 查看原帖并投递
          </a>
        )}
        <Link className="btn" href={`/editor/${resumeId}`}>去优化简历</Link>
      </div>

      {open && (
        <div className={styles.detail}>
          <MatchDetail match={match} />
          <details className={styles.jdDetails}>
            <summary>查看完整 JD（原文）</summary>
            <ScrollArea className={styles.jdScroll} ariaLabel="JD 全文"><pre className={styles.jdText}>{job.jdText}</pre></ScrollArea>
          </details>
        </div>
      )}
    </article>
  );
}

function AddJobDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (j: JobDto) => void }) {
  const [raw, setRaw] = useState("");
  const [form, setForm] = useState<ReturnType<typeof extractJobFromText> | null>(null);
  const [busy, setBusy] = useState(false);

  function doExtract() {
    if (raw.trim().length < 30) {
      toast.err("JD 内容太短");
      return;
    }
    const e = extractJobFromText(raw);
    setForm({ ...e });
    toast.ok("已识别薪资/城市/福利，请核对后保存");
  }

  async function doSave() {
    if (!form) return;
    setBusy(true);
    try {
      const j = await apiJsonBody<JobDto>("POST", "/api/jobs", { ...form, source: "extract" });
      onAdded(j);
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "保存失败");
      setBusy(false);
    }
  }

  const set = (k: keyof ReturnType<typeof extractJobFromText>) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className={styles.mask} onClick={onClose}>
      <div className={`${styles.dialog} card`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHead}>
          <h3><Briefcase size={15} /> 添加职位</h3>
          <button className="btn" onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </div>
        <div className={styles.dialogScroll}>
        <ScrollArea className={styles.dialogScrollArea} ariaLabel="添加职位内容">
        <p className={styles.hint}>把 BOSS 直聘 / 拉勾 / 猎聘等平台的职位描述整段粘贴进来，系统自动识别薪资、城市、福利标签与经验要求。</p>
        <textarea
          className={styles.importArea}
          rows={9}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"产品经理（数据方向）\n北京 · 25-40K·15薪\n五险一金 双休 弹性工作 年终奖\n岗位职责：负责数据平台规划…\n任职要求：3-5年 B 端产品经验，熟悉 SQL…"}
        />
        {form && (
          <>
            <div className={styles.grid2}>
              <div className="field"><label>公司</label><input value={form.company} onChange={(e) => set("company")(e.target.value)} /></div>
              <div className="field"><label>职位</label><input value={form.role} onChange={(e) => set("role")(e.target.value)} /></div>
              <div className="field"><label>城市</label><input value={form.city} onChange={(e) => set("city")(e.target.value)} /></div>
              <div className="field"><label>薪资</label><input value={form.salaryText} onChange={(e) => set("salaryText")(e.target.value)} /></div>
              <div className="field"><label>经验要求</label><input value={form.experienceReq} onChange={(e) => set("experienceReq")(e.target.value)} /></div>
              <div className="field"><label>学历要求</label><input value={form.educationReq} onChange={(e) => set("educationReq")(e.target.value)} /></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>来源渠道</label><Select value={form.channel} onChange={(v) => setForm((f) => (f ? { ...f, channel: v as JobCreateInput["channel"] } : f))} ariaLabel="来源渠道" options={CHANNELS.map((c) => ({ value: c, label: c }))} /></div>
            </div>
            <div className={styles.tagPick}>
              {KNOWN_BENEFITS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`${styles.filterTag} ${form.benefits.includes(b) ? styles.filterOn : ""}`}
                  onClick={() => setForm((f) => (f ? { ...f, benefits: f.benefits.includes(b) ? f.benefits.filter((x) => x !== b) : [...f.benefits, b] } : f))}
                >
                  {b}
                </button>
              ))}
            </div>
          </>
        )}
        </ScrollArea>
        </div>
        {form && (
          <div className={styles.importActions}>
            <button className="btn" onClick={() => setForm(null)}>重新识别</button>
            <button className="btn primary" onClick={doSave} disabled={busy}>{busy ? "保存中…" : "保存到职位库"}</button>
          </div>
        )}
        {!form && <button className="btn primary" onClick={doExtract}>智能识别</button>}
      </div>
    </div>
  );
}
