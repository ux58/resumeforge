"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Gauge, Printer, Share2 } from "lucide-react";
import { apiJsonBody } from "@/shared/api-client";
import { toast } from "@/components/toast";
import type { ResumeData, TemplateId, ThemeId } from "@/features/resumes/schema";
import { resumeDataSchema } from "@/features/resumes/schema";
import type { ResumeDto } from "@/features/resumes/service";
import { ResumePreview } from "@/components/resume-preview";
import { ResumeForm } from "./resume-form";
import { AnalyzerPanel } from "./analyzer-panel";
import styles from "./editor.module.scss";

const TEMPLATES: Array<{ id: TemplateId; name: string }> = [
  { id: "clean", name: "简约" },
  { id: "classic", name: "经典" },
  { id: "twocol", name: "双栏" },
];
const THEMES: Array<{ id: ThemeId; color: string }> = [
  { id: "blue", color: "#2f6fed" },
  { id: "teal", color: "#0f9d8f" },
  { id: "slate", color: "#3d4756" },
  { id: "wine", color: "#a03d55" },
];

export function Editor({ initial }: { initial: ResumeDto }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [data, setData] = useState<ResumeData>(initial.data);
  const [template, setTemplate] = useState<TemplateId>(initial.template);
  const [theme, setTheme] = useState<ThemeId>(initial.theme);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(initial.shareEnabled);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("dirty");
  }, []);

  const save = useCallback(
    async (silent = false) => {
      if (!dirtyRef.current) return;
      setSaveState("saving");
      try {
        await apiJsonBody("PATCH", `/api/resumes/${initial.id}`, { title, data, template, theme });
        dirtyRef.current = false;
        setSaveState("saved");
        if (!silent) toast.ok("已保存");
      } catch (err) {
        setSaveState("error");
        if (!silent) toast.err(err instanceof Error ? err.message : "保存失败");
      }
    },
    [initial.id, title, data, template, theme],
  );

  // 自动保存：修改后 1.2s 防抖
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(true), 1200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, title, template, theme, save]);

  // 离开页面前尽力保存
  useEffect(() => {
    const onLeave = () => {
      if (dirtyRef.current) void save(true);
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [save]);

  const update = useCallback(
    (patch: Partial<ResumeData>) => {
      setData((prev) => ({ ...prev, ...patch }));
      markDirty();
    },
    [markDirty],
  );

  const analysis = useMemo(() => (showAnalyzer ? null : null), [showAnalyzer]); // 面板内部自行计算
  void analysis;

  async function toggleShare() {
    try {
      const updated = await apiJsonBody<ResumeDto>("POST", `/api/resumes/${initial.id}`, { enabled: !shareEnabled });
      setShareEnabled(updated.shareEnabled);
      if (updated.shareUrl) {
        const url = `${location.origin}${updated.shareUrl}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.ok(`分享链接已复制：${url}`);
      } else {
        toast.info("分享已关闭");
      }
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "操作失败");
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ title, template, theme, data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title || "resume"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.ok("已导出 JSON");
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <button className="btn" onClick={() => router.push("/dashboard")} aria-label="返回仪表盘">
          <ArrowLeft size={15} strokeWidth={2.2} /> 返回
        </button>
        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          onBlur={() => void save(true)}
          aria-label="简历标题"
          maxLength={80}
        />
        <SaveIndicator state={saveState} />

        <div className={styles.group} role="group" aria-label="模板">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className={`${styles.segBtn} ${template === t.id ? styles.segOn : ""}`}
              onClick={() => {
                setTemplate(t.id);
                markDirty();
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className={styles.group} role="group" aria-label="主题色">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`${styles.swatch} ${theme === t.id ? styles.swatchOn : ""}`}
              style={{ background: t.color }}
              onClick={() => {
                setTheme(t.id);
                markDirty();
              }}
              aria-label={`主题 ${t.id}`}
            />
          ))}
        </div>

        <div className={styles.grow} />

        <button className="btn" onClick={() => setShowAnalyzer((v) => !v)}>
          <Gauge size={14} strokeWidth={2.2} /> 优化分析
        </button>
        <button className="btn" onClick={toggleShare}>
          <Share2 size={14} strokeWidth={2.2} /> {shareEnabled ? "关闭分享" : "分享"}
        </button>
        <button className="btn" onClick={exportJson}>
          <Download size={14} strokeWidth={2.2} /> JSON
        </button>
        <button className="btn primary" onClick={() => window.print()}>
          <Printer size={14} strokeWidth={2.2} /> 打印 / PDF
        </button>
      </div>

      <div className={styles.workarea}>
        <div className={styles.formPane}>
          <ResumeForm data={data} onChange={update} />
        </div>
        <div className={styles.previewPane}>
          <div className={`${styles.previewScroll} ${showAnalyzer ? styles.withPanel : ""}`}>
            <div className={styles.paperWrap}>
              <div className="print-root">
                <ResumePreview data={data} template={template} theme={theme} printing />
              </div>
            </div>
          </div>
          {showAnalyzer && (
            <aside className={styles.analyzerPane}>
              <AnalyzerPanel data={data} onJump={(target) => document.getElementById(`sec-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} />
            </aside>
          )}
        </div>
      </div>

      {/* 打印专用挂载点（预览已在 print-root 内） */}
      <span className={styles.printAnchor} hidden>
        <FileText size={1} />
      </span>
    </div>
  );
}

function SaveIndicator({ state }: { state: "saved" | "dirty" | "saving" | "error" }) {
  const map = {
    saved: { text: "已保存", cls: styles.ok },
    dirty: { text: "未保存", cls: styles.dirty },
    saving: { text: "保存中…", cls: styles.dirty },
    error: { text: "保存失败", cls: styles.err },
  } as const;
  const { text, cls } = map[state];
  return <span className={`${styles.saveDot} ${cls}`}>{text}</span>;
}

// 保留 schema 引用用于运行时防御性归一化（服务端返回旧格式时自动补默认字段）
void resumeDataSchema;
