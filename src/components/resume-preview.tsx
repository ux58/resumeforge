import type { ResumeData, TemplateId, ThemeId } from "@/features/resumes/schema";
import styles from "./resume-preview.module.scss";

const THEME_ACCENT: Record<ThemeId, string> = {
  blue: "#2f6fed",
  teal: "#0f9d8f",
  slate: "#3d4756",
  wine: "#a03d55",
};

export interface ResumePreviewProps {
  data: ResumeData;
  template: TemplateId;
  theme: ThemeId;
  /** 打印模式：挂在 .print-root 上由打印样式接管 */
  printing?: boolean;
}

export function ResumePreview({ data, template, theme, printing }: ResumePreviewProps) {
  const b = data.basics;
  const accent = THEME_ACCENT[theme] ?? THEME_ACCENT.blue;
  const cls = styles[template] ?? styles.clean;

  const contactLine = [b.email, b.phone, b.location, b.website].filter(Boolean);

  const header = (
    <header className={styles.head}>
      {b.name ? <h1>{b.name}</h1> : <h1 className={styles.phName}>姓名</h1>}
      {b.headline && <p className={styles.headline}>{b.headline}</p>}
      {contactLine.length > 0 && (
        <p className={styles.contact}>
          {contactLine.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </p>
      )}
    </header>
  );

  const summary = b.summary ? (
    <section>
      <h2>个人总结</h2>
      <p className={styles.summary}>{b.summary}</p>
    </section>
  ) : null;

  const experience = data.experience.length > 0 && (
    <section>
      <h2>工作经历</h2>
      {data.experience.map((e, i) => (
        <div className={styles.entry} key={i}>
          <div className={styles.entryHead}>
            <strong>{e.company || "公司"}</strong>
            <span className={styles.meta}>
              {[e.role, formatDateRange(e.start, e.end)].filter(Boolean).join(" · ")}
            </span>
          </div>
          {splitBullets(e.bullets).length > 0 && (
            <ul>
              {splitBullets(e.bullets).map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );

  const education = data.education.length > 0 && (
    <section>
      <h2>教育经历</h2>
      {data.education.map((e, i) => (
        <div className={styles.entry} key={i}>
          <div className={styles.entryHead}>
            <strong>{e.school || "学校"}</strong>
            <span className={styles.meta}>{[e.degree, e.field, formatDateRange(e.start, e.end)].filter(Boolean).join(" · ")}</span>
          </div>
          {e.desc && <p className={styles.desc}>{e.desc}</p>}
        </div>
      ))}
    </section>
  );

  const projects = data.projects.length > 0 && (
    <section>
      <h2>项目经历</h2>
      {data.projects.map((p, i) => (
        <div className={styles.entry} key={i}>
          <div className={styles.entryHead}>
            <strong>{p.name || "项目"}</strong>
            <span className={styles.meta}>{[p.role, p.tech].filter(Boolean).join(" · ")}</span>
          </div>
          {p.link && <p className={styles.link}>{p.link}</p>}
          {splitBullets(p.desc).length > 0 && (
            <ul>
              {splitBullets(p.desc).map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );

  const certs = data.certs.length > 0 && (
    <section>
      <h2>证书</h2>
      <ul className={styles.plainList}>
        {data.certs.map((c, i) => (
          <li key={i}>{[c.name, c.issuer, c.date].filter(Boolean).join(" · ")}</li>
        ))}
      </ul>
    </section>
  );

  const customs = data.customs.length > 0 && (
    <>
      {data.customs.map((c, i) => (
        <section key={i}>
          <h2>{c.title}</h2>
          {splitBullets(c.content).length > 1 ? (
            <ul>{splitBullets(c.content).map((line, j) => <li key={j}>{line}</li>)}</ul>
          ) : (
            <p className={styles.desc}>{c.content}</p>
          )}
        </section>
      ))}
    </>
  );

  const skillsSection = data.skills.length > 0 && (
    <section>
      <h2>专业技能</h2>
      <div className={styles.skillChips}>
        {data.skills.map((s, i) => (
          <span className={styles.chip} key={i}>
            {s.name}
            <i className={styles.dots} aria-hidden>
              {Array.from({ length: 5 }, (_, d) => (
                <b key={d} className={d < s.level ? styles.dotOn : styles.dotOff} />
              ))}
            </i>
          </span>
        ))}
      </div>
    </section>
  );

  if (template === "twocol") {
    return (
      <article className={`${styles.paper} ${cls}`} style={{ "--accent-c": accent } as React.CSSProperties} data-printing={printing ? "1" : undefined}>
        {header}
        <div className={styles.twocolBody}>
          <div className={styles.colMain}>
            {summary}
            {experience}
            {projects}
          </div>
          <div className={styles.colSide}>
            {skillsSection}
            {education}
            {certs}
            {customs}
          </div>
        </div>
      </article>
    );
  }

  if (template === "sidebar") {
    // 左侧深色信息栏 + 右侧主内容
    const rail = (
      <aside className={styles.sideRail}>
        <div className={styles.railName}>{b.name || "姓名"}</div>
        {b.headline && <p className={styles.railHeadline}>{b.headline}</p>}
        <div className={styles.railBlock}>
          <h3>联系方式</h3>
          {b.email && <p>{b.email}</p>}
          {b.phone && <p>{b.phone}</p>}
          {b.location && <p>{b.location}</p>}
          {b.website && <p className={styles.railLink}>{b.website}</p>}
        </div>
        {skillsSection}
        {education}
        {certs}
      </aside>
    );
    return (
      <article className={`${styles.paper} ${cls} ${styles.sidebarLayout}`} style={{ "--accent-c": accent } as React.CSSProperties} data-printing={printing ? "1" : undefined}>
        {rail}
        <div className={styles.sideMain}>
          {summary}
          {experience}
          {projects}
          {customs}
        </div>
      </article>
    );
  }

  if (template === "banner") {
    // 顶部大横幅 + 左侧强调线的分区
    return (
      <article className={`${styles.paper} ${cls} ${styles.bannerLayout}`} style={{ "--accent-c": accent } as React.CSSProperties} data-printing={printing ? "1" : undefined}>
        <header className={styles.bannerHead}>
          <div>
            <h1>{b.name || "姓名"}</h1>
            {b.headline && <p className={styles.bannerHeadline}>{b.headline}</p>}
          </div>
          <div className={styles.bannerContact}>
            {b.email && <span>{b.email}</span>}
            {b.phone && <span>{b.phone}</span>}
            {b.location && <span>{b.location}</span>}
            {b.website && <span>{b.website}</span>}
          </div>
        </header>
        {summary}
        <div className={styles.bannerCols}>
          <div className={styles.bannerMain}>
            {experience}
            {projects}
          </div>
          <div className={styles.bannerSide}>
            {skillsSection}
            {education}
            {certs}
            {customs}
          </div>
        </div>
      </article>
    );
  }

  if (template === "timeline") {
    // 时间线：经历条目带轴线与节点
    const timelineExp = data.experience.length > 0 && (
      <section className={styles.tlSection}>
        <h2>工作经历</h2>
        {data.experience.map((e, i) => (
          <div className={styles.tlItem} key={i}>
            <div className={styles.tlMeta}>
              <span className={styles.tlDate}>{formatDateRange(e.start, e.end)}</span>
            </div>
            <div className={styles.tlBody}>
              <strong>{e.company || "公司"}</strong>
              <span className={styles.tlRole}>{e.role}</span>
              {splitBullets(e.bullets).length > 0 && (
                <ul>
                  {splitBullets(e.bullets).map((line, j) => (
                    <li key={j}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </section>
    );
    const timelineEdu = data.education.length > 0 && (
      <section className={styles.tlSection}>
        <h2>教育经历</h2>
        {data.education.map((e, i) => (
          <div className={styles.tlItem} key={i}>
            <div className={styles.tlMeta}>
              <span className={styles.tlDate}>{formatDateRange(e.start, e.end)}</span>
            </div>
            <div className={styles.tlBody}>
              <strong>{e.school || "学校"}</strong>
              <span className={styles.tlRole}>{[e.degree, e.field].filter(Boolean).join(" · ")}</span>
              {e.desc && <p className={styles.desc}>{e.desc}</p>}
            </div>
          </div>
        ))}
      </section>
    );
    return (
      <article className={`${styles.paper} ${cls} ${styles.timelineLayout}`} style={{ "--accent-c": accent } as React.CSSProperties} data-printing={printing ? "1" : undefined}>
        {header}
        {summary}
        {timelineExp}
        {projects}
        {timelineEdu}
        {skillsSection}
        {certs}
        {customs}
      </article>
    );
  }

  return (
    <article className={`${styles.paper} ${cls}`} style={{ "--accent-c": accent } as React.CSSProperties} data-printing={printing ? "1" : undefined}>
      {header}
      {summary}
      {experience}
      {projects}
      {education}
      {skillsSection}
      {certs}
      {customs}
    </article>
  );
}

/* ---------- helpers ---------- */

function formatDateRange(start: string, end: string): string {
  if (!start && !end) return "";
  return [start, end || (end === "" ? "至今" : "")].filter(Boolean).join(" – ");
}

function splitBullets(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[。；;])\s*/)
    .map((s) => s.replace(/^[-•·*\d.、\s]+/, "").trim())
    .filter(Boolean);
}
