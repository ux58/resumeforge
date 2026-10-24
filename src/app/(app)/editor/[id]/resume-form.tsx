"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { ResumeData, ResumeBasics } from "@/features/resumes/schema";
import styles from "./resume-form.module.scss";

export interface ResumeFormProps {
  data: ResumeData;
  onChange: (patch: Partial<ResumeData>) => void;
}

/** 左侧表单：分模块手风琴，行内增删 */
export function ResumeForm({ data, onChange }: ResumeFormProps) {
  return (
    <div className={styles.form}>
      <Section id="basics" title="基本信息" defaultOpen>
        <BasicsFields
          basics={data.basics}
          onChange={(basics: ResumeBasics) => onChange({ basics })}
        />
      </Section>

      <Section id="summary" title="个人总结">
        <p className={styles.tip}>2-3 句话说明你的定位、年限与核心优势（建议 100-200 字）</p>
        <textarea
          rows={5}
          value={data.basics.summary}
          onChange={(e) => onChange({ basics: { ...data.basics, summary: e.target.value } })}
          placeholder="例：5 年后端开发经验，主导过日活 10 万+ 系统的架构升级，擅长高并发与稳定性建设…"
        />
      </Section>

      <Section id="targetJob" title="目标职位 JD（用于关键词匹配）">
        <p className={styles.tip}>粘贴目标岗位的「岗位职责 + 任职要求」，分析器会比对简历覆盖度</p>
        <textarea
          rows={5}
          value={data.targetJob}
          onChange={(e) => onChange({ targetJob: e.target.value })}
          placeholder="职责：负责… 任职要求：熟悉…"
        />
      </Section>

      <Section id="experience" title={`工作经历${data.experience.length ? `（${data.experience.length}）` : ""}`} defaultOpen>
        {data.experience.map((item, i) => (
          <RepeaterCard
            key={i}
            onDelete={() => onChange({ experience: data.experience.filter((_, j) => j !== i) })}
          >
            <div className={styles.grid2}>
              <Field label="公司" value={item.company} onChange={(v) => replaceAt(data.experience, i, { company: v }, (d) => onChange({ experience: d }))} />
              <Field label="职位" value={item.role} onChange={(v) => replaceAt(data.experience, i, { role: v }, (d) => onChange({ experience: d }))} />
              <Field label="开始（如 2021.06）" value={item.start} onChange={(v) => replaceAt(data.experience, i, { start: v }, (d) => onChange({ experience: d }))} />
              <Field label="结束（留空 = 至今）" value={item.end} onChange={(v) => replaceAt(data.experience, i, { end: v }, (d) => onChange({ experience: d }))} />
            </div>
            <Field
              label="工作内容（每行一条成果，建议「动词 + 量化结果」）"
              value={item.bullets}
              textarea
              rows={5}
              onChange={(v) => replaceAt(data.experience, i, { bullets: v }, (d) => onChange({ experience: d }))}
              placeholder={"主导支付网关重构，接口 P99 从 800ms 降至 120ms\n搭建灰度发布体系，线上事故率下降 70%"}
            />
          </RepeaterCard>
        ))}
        <AddButton label="添加工作经历" onClick={() => onChange({ experience: [...data.experience, { company: "", role: "", start: "", end: "", bullets: "" }] })} />
      </Section>

      <Section id="projects" title={`项目经历${data.projects.length ? `（${data.projects.length}）` : ""}`}>
        {data.projects.map((item, i) => (
          <RepeaterCard key={i} onDelete={() => onChange({ projects: data.projects.filter((_, j) => j !== i) })}>
            <div className={styles.grid2}>
              <Field label="项目名" value={item.name} onChange={(v) => replaceAt(data.projects, i, { name: v }, (d) => onChange({ projects: d }))} />
              <Field label="角色" value={item.role} onChange={(v) => replaceAt(data.projects, i, { role: v }, (d) => onChange({ projects: d }))} />
              <Field label="技术栈" value={item.tech} onChange={(v) => replaceAt(data.projects, i, { tech: v }, (d) => onChange({ projects: d }))} />
              <Field label="链接（可选）" value={item.link} onChange={(v) => replaceAt(data.projects, i, { link: v }, (d) => onChange({ projects: d }))} />
            </div>
            <Field
              label="项目描述（每行一条）"
              value={item.desc}
              textarea
              rows={4}
              onChange={(v) => replaceAt(data.projects, i, { desc: v }, (d) => onChange({ projects: d }))}
            />
          </RepeaterCard>
        ))}
        <AddButton label="添加项目" onClick={() => onChange({ projects: [...data.projects, { name: "", role: "", link: "", tech: "", desc: "" }] })} />
      </Section>

      <Section id="education" title={`教育经历${data.education.length ? `（${data.education.length}）` : ""}`}>
        {data.education.map((item, i) => (
          <RepeaterCard key={i} onDelete={() => onChange({ education: data.education.filter((_, j) => j !== i) })}>
            <div className={styles.grid2}>
              <Field label="学校" value={item.school} onChange={(v) => replaceAt(data.education, i, { school: v }, (d) => onChange({ education: d }))} />
              <Field label="学历" value={item.degree} onChange={(v) => replaceAt(data.education, i, { degree: v }, (d) => onChange({ education: d }))} />
              <Field label="专业" value={item.field} onChange={(v) => replaceAt(data.education, i, { field: v }, (d) => onChange({ education: d }))} />
              <Field label="起止（如 2017 – 2021）" value={item.start} onChange={(v) => replaceAt(data.education, i, { start: v }, (d) => onChange({ education: d }))} />
            </div>
            <Field label="备注（GPA / 荣誉，可选）" value={item.desc} onChange={(v) => replaceAt(data.education, i, { desc: v }, (d) => onChange({ education: d }))} />
          </RepeaterCard>
        ))}
        <AddButton
          label="添加教育经历"
          onClick={() => onChange({ education: [...data.education, { school: "", degree: "", field: "", start: "", end: "", desc: "" }] })}
        />
      </Section>

      <Section id="skills" title={`专业技能${data.skills.length ? `（${data.skills.length}）` : ""}`}>
        <div className={styles.skillRows}>
          {data.skills.map((s, i) => (
            <div className={styles.skillRow} key={i}>
              <input
                value={s.name}
                onChange={(e) => replaceAt(data.skills, i, { ...s, name: e.target.value }, (d) => onChange({ skills: d }))}
                placeholder="技能名"
                aria-label={`技能 ${i + 1} 名称`}
              />
              <div className={styles.level} role="group" aria-label={`技能 ${i + 1} 熟练度`}>
                {[1, 2, 3, 4, 5].map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    className={`${styles.levelDot} ${lv <= s.level ? styles.levelOn : ""}`}
                    onClick={() => replaceAt(data.skills, i, { ...s, level: lv }, (d) => onChange({ skills: d }))}
                    aria-label={`熟练度 ${lv}`}
                  />
                ))}
              </div>
              <button
                className={`${styles.del} btn danger`}
                onClick={() => onChange({ skills: data.skills.filter((_, j) => j !== i) })}
                aria-label={`删除技能 ${s.name || i + 1}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <AddButton label="添加技能" onClick={() => onChange({ skills: [...data.skills, { name: "", level: 3 }] })} />
      </Section>

      <Section id="certs" title={`证书${data.certs.length ? `（${data.certs.length}）` : ""}`}>
        {data.certs.map((item, i) => (
          <RepeaterCard key={i} onDelete={() => onChange({ certs: data.certs.filter((_, j) => j !== i) })}>
            <div className={styles.grid2}>
              <Field label="证书名" value={item.name} onChange={(v) => replaceAt(data.certs, i, { name: v }, (d) => onChange({ certs: d }))} />
              <Field label="颁发机构" value={item.issuer} onChange={(v) => replaceAt(data.certs, i, { issuer: v }, (d) => onChange({ certs: d }))} />
              <Field label="日期" value={item.date} onChange={(v) => replaceAt(data.certs, i, { date: v }, (d) => onChange({ certs: d }))} />
            </div>
          </RepeaterCard>
        ))}
        <AddButton label="添加证书" onClick={() => onChange({ certs: [...data.certs, { name: "", issuer: "", date: "" }] })} />
      </Section>

      <Section id="customs" title={`自定义模块${data.customs.length ? `（${data.customs.length}）` : ""}`}>
        <p className={styles.tip}>如「获奖情况」「社区贡献」「语言能力」等，自由扩展</p>
        {data.customs.map((item, i) => (
          <RepeaterCard key={i} onDelete={() => onChange({ customs: data.customs.filter((_, j) => j !== i) })}>
            <Field label="模块标题" value={item.title} onChange={(v) => replaceAt(data.customs, i, { title: v }, (d) => onChange({ customs: d }))} />
            <Field
              label="内容（每行一条或整段）"
              value={item.content}
              textarea
              rows={4}
              onChange={(v) => replaceAt(data.customs, i, { content: v }, (d) => onChange({ customs: d }))}
            />
          </RepeaterCard>
        ))}
        <AddButton label="添加自定义模块" onClick={() => onChange({ customs: [...data.customs, { title: "", content: "" }] })} />
      </Section>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function BasicsFields({ basics, onChange }: { basics: ResumeBasics; onChange: (b: ResumeBasics) => void }) {
  const set = (k: keyof ResumeBasics) => (v: string) => onChange({ ...basics, [k]: v });
  return (
    <div className={styles.grid2}>
      <Field label="姓名 *" value={basics.name} onChange={set("name")} />
      <Field label="求职意向 / 一句话定位 *" value={basics.headline} onChange={set("headline")} placeholder="如：后端开发工程师（Go/云原生）" />
      <Field label="邮箱" value={basics.email} onChange={set("email")} type="email" />
      <Field label="手机号" value={basics.phone} onChange={set("phone")} />
      <Field label="所在城市" value={basics.location} onChange={set("location")} />
      <Field label="主页 / GitHub（可选）" value={basics.website} onChange={set("website")} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  rows,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <textarea rows={rows ?? 3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type ?? "text"} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Section({ id, title, children, defaultOpen }: { id: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className={styles.section} id={`sec-${id}`}>
      <button className={styles.sectionHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {title}
        <ChevronDown size={15} className={open ? styles.chevOpen : styles.chev} />
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

function RepeaterCard({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <div className={styles.repeater}>
      <button className={`${styles.del} btn danger`} onClick={onDelete} aria-label="删除此条">
        <Trash2 size={13} />
      </button>
      {children}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className={`${styles.addBtn} btn`} onClick={onClick}>
      <Plus size={14} strokeWidth={2.3} /> {label}
    </button>
  );
}

function replaceAt<T>(list: T[], index: number, patch: Partial<T>, commit: (next: T[]) => void): void {
  const next = list.map((item, i) => (i === index ? { ...item, ...patch } : item));
  commit(next);
}
