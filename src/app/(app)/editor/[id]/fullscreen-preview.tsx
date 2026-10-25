"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { ResumeData, TemplateId, ThemeId } from "@/features/resumes/schema";
import { ResumePreview } from "@/components/resume-preview";
import { ScrollArea } from "@/components/scroll-area";
import styles from "./fullscreen-preview.module.scss";

const A4_W = 794; // 210mm @96dpi
const A4_H = 1123; // 297mm @96dpi

type FitMode = "width" | "page";

/**
 * 全屏预览：适合宽度 / 适合整页 两种基准 + 手动缩放（±25%/步），Esc 关闭。
 */
export function FullscreenPreview({
  data,
  template,
  theme,
  onClose,
}: {
  data: ResumeData;
  template: TemplateId;
  theme: ThemeId;
  onClose: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<FitMode>("width");
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const base = mode === "width" ? Math.min(1.6, (box.w - 48) / A4_W) : Math.min(1.6, (box.w - 48) / A4_W, (box.h - 32) / A4_H);
  const scale = Math.max(0.3, Math.min(1.8, base * zoom));
  const dx = Math.max(0, (box.w - A4_W * scale) / 2);

  const setZoomStep = useCallback((dir: 1 | -1) => setZoom((z) => Math.max(0.4, Math.min(2.5, +(z + dir * 0.25).toFixed(2)))), []);

  return (
    <div className={styles.overlay} role="dialog" aria-label="简历全屏预览">
      <header className={styles.toolbar}>
        <div className={styles.modeGroup} role="group" aria-label="适配模式">
          <button className={`${styles.modeBtn} ${mode === "width" ? styles.modeOn : ""}`} onClick={() => { setMode("width"); setZoom(1); }}>适合宽度</button>
          <button className={`${styles.modeBtn} ${mode === "page" ? styles.modeOn : ""}`} onClick={() => { setMode("page"); setZoom(1); }}>适合整页</button>
        </div>
        <div className={styles.zoomGroup} role="group" aria-label="缩放">
          <button className={styles.iconBtn} onClick={() => setZoomStep(-1)} aria-label="缩小"><Minus size={14} /></button>
          <span className={styles.zoomVal}>{Math.round(scale * 100)}%</span>
          <button className={styles.iconBtn} onClick={() => setZoomStep(1)} aria-label="放大"><Plus size={14} /></button>
        </div>
        <span className={styles.hint}>Esc 关闭</span>
        <button className="btn" onClick={onClose} aria-label="关闭全屏预览"><X size={15} /> 关闭</button>
      </header>
      <div ref={areaRef} className={styles.stage}>
        <ScrollArea className={styles.stageScroll} ariaLabel="全屏简历预览">
          <div className={styles.paperHolder} style={{ width: Math.round(A4_W * scale), height: Math.round(A4_H * scale) + 24 }}>
            <div className={styles.paperInner} style={{ transform: `translateX(${dx}px) scale(${scale})` }}>
              <ResumePreview data={data} template={template} theme={theme} />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

