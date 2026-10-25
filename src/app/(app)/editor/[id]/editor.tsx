"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Gauge, History, Printer, Share2, Wand2, FileUp } from "lucide-react";
import { apiJsonBody } from "@/shared/api-client";
import { toast } from "@/components/toast";
import type { ResumeData, TemplateId, ThemeId } from "@/features/resumes/schema";
import type { ResumeDto } from "@/features/resumes/service";
import { ResumePreview } from "@/components/resume-preview";
import { ScrollArea } from "@/components/scroll-area";
import { ResumeForm } from "./resume-form";
import { AnalyzerPanel } from "./analyzer-panel";
import { HistoryPanel } from "./history-panel";
import { OptimizePanel } from "./optimize-panel";
import { ImportDialog } from "./import-dialog";
import styles from "./editor.module.scss";

const TEMPLATES: Array<{ id: TemplateId; name: string }> = [
  { id: "clean", name: "简约" },
  { id: "classic", name: "经典" },
  { id: "twocol", name: "双栏" },
  { id: "sidebar", name: "侧栏" },
  { id: "banner", name: "横幅" },
  { id: "timeline", name: "时间线" },
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
  const [showHistory, setShowHistory] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(initial.shareEnabled);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("dirty");
  }, []);

  const save = useCallback(
    async (silent = false, source: "edit" | "autosave" | "optimize" | "rollback" = "autosave") => {
      if (!dirtyRef.current && source === "autosave") return;
      setSaveState("saving");
      try {
        await apiJsonBody("PATCH", `/api/resumes/${initial.id}`, { title, data, template, theme, source });
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

  const analysis = useMemo(() => (showAnalyzer || showHistory || showOptimize), [showAnalyzer, showHistory, showOptimize]);
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

        <button className="btn" onClick={() => { setShowHistory((v) => !v); setShowOptimize(false); setShowAnalyzer(false); }}>
          <History size={14} strokeWidth={2.2} /> 历史版本
        </button>
        <button className="btn" onClick={() => { setShowOptimize((v) => !v); setShowHistory(false); setShowAnalyzer(false); }}>
          <Wand2 size={14} strokeWidth={2.2} /> 一键优化
        </button>
        <button className="btn" onClick={() => setShowImport(true)}>
          <FileUp size={14} strokeWidth={2.2} /> 导入
        </button>
        <button className="btn" onClick={() => { setShowAnalyzer((v) => !v); setShowHistory(false); setShowOptimize(false); }}>
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
        <ScrollArea className={styles.formPane} ariaLabel="简历表单">
          <ResumeForm data={data} onChange={update} />
        </ScrollArea>
        <div className={styles.previewPane}>
          <ScrollArea className={`${styles.previewScroll} ${analysis ? styles.withPanel : ""}`} ariaLabel="简历预览">
            <PaperScaler>
              <div className="print-root">
                <ResumePreview data={data} template={template} theme={theme} printing />
              </div>
            </PaperScaler>
          </ScrollArea>
          {showAnalyzer && !showHistory && !showOptimize && (
            <aside className={styles.analyzerPane}>
              <AnalyzerPanel data={data} onJump={(target) => document.getElementById(`sec-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} />
            </aside>
          )}
          {showHistory && (
            <ScrollArea className={styles.analyzerPane} ariaLabel="历史版本">
              <HistoryPanel
                resumeId={initial.id}
                currentData={data}
                currentTitle={title}
                onClose={() => setShowHistory(false)}
                onRestore={(next, tpl, th) => {
                  setData(next);
                  setTemplate(tpl as TemplateId);
                  setTheme(th as ThemeId);
                  markDirty();
                  void save(false, "rollback");
                }}
              />
            </ScrollArea>
          )}
          {showOptimize && (
            <ScrollArea className={styles.analyzerPane} ariaLabel="一键优化">
              <OptimizePanel
                data={data}
                onClose={() => setShowOptimize(false)}
                onApply={(next) => {
                  setData(next);
                  markDirty();
                  void save(false, "optimize");
                  setShowOptimize(false);
                }}
              />
            </ScrollArea>
          )}
        </div>
      </div>

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImport={(imported) => {
            setData((prev) => ({
              ...prev,
              ...imported,
              basics: {
                ...prev.basics,
                ...imported.basics,
                summary: imported.basics.summary || prev.basics.summary,
              },
            }));
            markDirty();
            toast.ok("已导入到表单，请核对后保存");
          }}
        />
      )}

      <span className={styles.printAnchor} hidden>
        <Gauge size={1} />
      </span>
    </div>
  );
}

/** A4 纸自适应缩放：容器内完整显示（水平居中 + 等比缩放），任意面板/窗口宽度零裁切 */
function PaperScaler({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, dx: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const A4_W = 794; // 210mm @96dpi
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const scale = Math.min(1, (w - 12) / A4_W);
      setFit({ scale, dx: Math.max(0, (w - A4_W * scale) / 2) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={styles.scaleWrap} style={{ height: Math.round(1123 * fit.scale) + 48 }}>
      <div className={styles.scaleInner} style={{ transform: `translateX(${fit.dx}px) scale(${fit.scale})` }}>
        {children}
      </div>
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
