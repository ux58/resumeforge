"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { toast } from "@/components/toast";
import type { ResumeDto } from "@/features/resumes/service";
import type { ResumeData } from "@/features/resumes/schema";
import { ResumePreview } from "@/components/resume-preview";
import styles from "./panels.module.scss";

const SOURCE_LABEL: Record<string, string> = {
  create: "初始创建",
  edit: "手动编辑",
  autosave: "自动保存",
  optimize: "一键优化",
  rollback: "版本回退",
};

export interface VersionItem {
  id: string;
  title: string;
  template: string;
  theme: string;
  source: string;
  createdAt: string;
}

/** 历史版本抽屉：列表 → 预览快照 → 一键回退（回退本身也会记录新版本） */
export function HistoryPanel({
  resumeId,
  currentData,
  currentTitle,
  onClose,
  onRestore,
}: {
  resumeId: string;
  currentData: ResumeData;
  currentTitle: string;
  onClose: () => void;
  onRestore: (data: ResumeData, template: string, theme: string) => void;
}) {
  const [items, setItems] = useState<VersionItem[] | null>(null);
  const [preview, setPreview] = useState<ResumeDto | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    apiJson<{ items: VersionItem[] }>(`/api/resumes/${resumeId}/versions`)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [resumeId]);

  async function openPreview(v: VersionItem) {
    setLoadingId(v.id);
    try {
      const dto = await apiJson<ResumeDto>(`/api/resumes/${resumeId}/versions/${v.id}`);
      setPreview(dto);
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "版本加载失败");
    } finally {
      setLoadingId(null);
    }
  }

  async function restore() {
    if (!preview) return;
    if (!confirm(`回退到 ${new Date(preview.createdAt).toLocaleString("zh-CN")} 的版本？当前未保存的修改将丢失（当前状态会先自动保存为一个新版本）。`)) return;
    setRestoring(true);
    try {
      // 先把当前状态保存为版本（可追溯），再应用历史版本
      await apiJsonBody("PATCH", `/api/resumes/${resumeId}`, { title: currentTitle, data: currentData, source: "autosave" }).catch(() => {});
      await apiJsonBody("PATCH", `/api/resumes/${resumeId}`, {
        title: preview.title,
        data: preview.data,
        template: preview.template,
        theme: preview.theme,
        source: "rollback",
      });
      toast.ok("已回退（当前状态已留档）");
      onRestore(preview.data, preview.template, preview.theme);
      onClose();
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "回退失败");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className={styles.drawer}>
      <div className={styles.drawerHead}>
        <h3><History size={15} /> 历史版本</h3>
        <button className="btn" onClick={onClose} aria-label="关闭"><X size={15} /></button>
      </div>
      <p className={styles.hint}>每次保存/优化/回退都会自动留档（上限 50 份），回退不会丢失任何历史。</p>

      <div className={styles.versionList}>
        {items === null && <p className={styles.hint}>加载中…</p>}
        {items?.length === 0 && <p className={styles.hint}>暂无历史版本</p>}
        {items?.map((v) => (
          <div key={v.id} className={`${styles.versionItem} ${preview?.createdAt === v.createdAt ? styles.versionOn : ""}`}>
            <button className={styles.versionBtn} onClick={() => openPreview(v)} disabled={loadingId === v.id}>
              <span className={styles.vSource}>{SOURCE_LABEL[v.source] ?? v.source}</span>
              <span className={styles.vTime}>{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
              <span className={styles.vTitle}>{v.title}</span>
            </button>
          </div>
        ))}
      </div>

      {preview && (
        <div className={styles.previewBlock}>
          <div className={styles.previewMeta}>
            <span>预览：{SOURCE_LABEL[items?.find((v) => v.createdAt === preview.createdAt)?.source ?? ""] ?? ""}</span>
            <button className="btn primary" onClick={restore} disabled={restoring}>
              <RotateCcw size={13} /> 回退到此版本
            </button>
          </div>
          <div className={styles.previewPaper}>
            <ResumePreview data={preview.data} template={preview.template} theme={preview.theme} />
          </div>
        </div>
      )}
    </div>
  );
}
