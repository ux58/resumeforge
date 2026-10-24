"use client";

import { useMemo } from "react";
import { AlertTriangle, CircleCheck, Lightbulb } from "lucide-react";
import { analyzeResume, type Suggestion } from "@/features/analysis/engine";
import type { ResumeData } from "@/features/resumes/schema";
import styles from "./analyzer.module.scss";

const TARGET_LABEL: Record<Suggestion["target"], string> = {
  basics: "基本信息",
  summary: "个人总结",
  experience: "工作经历",
  education: "教育经历",
  projects: "项目经历",
  skills: "技能",
  certs: "证书",
  targetJob: "目标 JD",
};

const SEV_ORDER: Record<Suggestion["severity"], number> = { high: 0, medium: 1, low: 2 };

export function AnalyzerPanel({ data, onJump }: { data: ResumeData; onJump: (target: Suggestion["target"]) => void }) {
  const result = useMemo(() => analyzeResume(data), [data]);
  const tone = result.total >= 80 ? styles.good : result.total >= 60 ? styles.mid : styles.low;

  return (
    <div className={styles.panel}>
      <div className={styles.gaugeCard}>
        <Gauge total={result.total} tone={tone} />
        <p className={styles.gaugeText}>
          {result.total >= 80 ? "优秀：达到可投递水准" : result.total >= 60 ? "良好：还有明确的提分空间" : "待改进：先处理高优先级建议"}
        </p>
      </div>

      <Radar dimensions={result.dimensions} />

      <div className={styles.section}>
        <h3>优化建议（{result.suggestions.length}）</h3>
        {result.suggestions.length === 0 ? (
          <p className={styles.allGood}><CircleCheck size={15} /> 未发现问题，可以投递了</p>
        ) : (
          <ul className={styles.suggestions}>
            {[...result.suggestions]
              .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
              .map((s, i) => (
                <li key={i} className={`${styles.suggestion} ${styles[s.severity]}`}>
                  <button className={styles.suggestionBtn} onClick={() => onJump(s.target)}>
                    <span className={styles.sevIcon}>
                      {s.severity === "high" ? <AlertTriangle size={13} /> : <Lightbulb size={13} />}
                    </span>
                    <span className={styles.suggestionText}>
                      <em className={styles.target}>{TARGET_LABEL[s.target]}</em>
                      {s.message}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {result.keywords.missing.length > 0 && (
        <div className={styles.section}>
          <h3>JD 未覆盖关键词</h3>
          <div className={styles.kwWrap}>
            {result.keywords.missing.map((k) => (
              <span key={k} className={`${styles.kw} ${styles.kwMiss}`}>{k}</span>
            ))}
          </div>
        </div>
      )}
      {result.keywords.matched.length > 0 && (
        <div className={styles.section}>
          <h3>已覆盖关键词（{result.keywords.matched.length}）</h3>
          <div className={styles.kwWrap}>
            {result.keywords.matched.slice(0, 14).map((k) => (
              <span key={k} className={`${styles.kw} ${styles.kwHit}`}>{k}</span>
            ))}
          </div>
        </div>
      )}

      <p className={styles.footer}>
        条目 {result.stats.bullets} 条 · 正文约 {result.stats.words} 字
      </p>
    </div>
  );
}

function Gauge({ total, tone }: { total: number; tone: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (total / 100) * circ;
  return (
    <div className={`${styles.gauge} ${tone}`}>
      <svg viewBox="0 0 110 110" width="120" height="120" aria-label={`总分 ${total}`}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke="currentColor" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="58" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="currentColor">
          {total}
        </text>
        <text x="55" y="76" textAnchor="middle" fontSize="9" fill="var(--text-faint)">总分 / 100</text>
      </svg>
    </div>
  );
}

function Radar({ dimensions }: { dimensions: { label: string; score: number }[] }) {
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const rMax = 70;
  const n = dimensions.length;
  const pt = (i: number, ratio: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * rMax * ratio, cy + Math.sin(angle) * rMax * ratio];
  };
  const poly = dimensions.map((d, i) => pt(i, Math.max(0.04, d.score / 100)).join(",")).join(" ");

  return (
    <div className={styles.radarWrap}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="六维评分雷达图">
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon
            key={ring}
            points={dimensions.map((_, i) => pt(i, ring).join(",")).join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {dimensions.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
        })}
        <polygon points={poly} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.8" />
        {dimensions.map((d, i) => {
          const [x, y] = pt(i, d.score / 100);
          return <circle key={i} cx={x} cy={y} r="2.6" fill="var(--accent)" />;
        })}
        {dimensions.map((d, i) => {
          const [x, y] = pt(i, 1.24);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--text-dim)">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
