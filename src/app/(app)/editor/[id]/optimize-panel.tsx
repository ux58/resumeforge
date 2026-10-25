"use client";

import { useMemo, useState } from "react";
import { Check, Wand2, X } from "lucide-react";
import { planOptimizations, applyOptimizations, type OptimizeOp } from "@/features/analysis/optimize";
import type { ResumeData } from "@/features/resumes/schema";
import { toast } from "@/components/toast";
import styles from "./panels.module.scss";

const KIND_LABEL: Record<OptimizeOp["kind"], string> = {
  "weak-verb": "弱动词升级",
  dedupe: "去重",
  cleanup: "格式清理",
  "summary-draft": "总结草稿",
};

/** 一键优化面板：生成变换清单 → 勾选 → 应用（自动留版本，可再回退） */
export function OptimizePanel({
  data,
  onClose,
  onApply,
}: {
  data: ResumeData;
  onClose: () => void;
  onApply: (next: ResumeData) => void;
}) {
  const ops = useMemo(() => planOptimizations(data), [data]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ops.filter((o) => o.defaultOn).map((o) => o.id)));
  const [applied, setApplied] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    if (!selected.size) {
      toast.info("请至少勾选一项");
      return;
    }
    const next = applyOptimizations(data, ops, [...selected]);
    onApply(next);
    setApplied(true);
    toast.ok(`已应用 ${selected.size} 项优化（原状态已存入历史版本，可随时回退）`);
  }

  return (
    <div className={styles.drawer}>
      <div className={styles.drawerHead}>
        <h3><Wand2 size={15} /> 一键优化</h3>
        <button className="btn" onClick={onClose} aria-label="关闭"><X size={15} /></button>
      </div>
      <p className={styles.hint}>
        仅执行语义无损的安全变换，每项可单独取消；应用后原状态自动存入历史版本。
      </p>

      {ops.length === 0 ? (
        <p className={styles.hint}>当前简历已符合全部优化规则，无需调整 👍</p>
      ) : (
        <div className={styles.opsList}>
          {ops.map((op) => (
            <label key={op.id} className={`${styles.opCard} ${selected.has(op.id) ? styles.opOn : ""}`}>
              <input
                type="checkbox"
                checked={selected.has(op.id)}
                onChange={() => toggle(op.id)}
                disabled={applied}
              />
              <span className={styles.opBody}>
                <span className={styles.opHead}>
                  <b className={styles.opKind}>{KIND_LABEL[op.kind]}</b>
                  <span className={styles.opTarget}>{op.target}</span>
                </span>
                <span className={styles.opDiff}>
                  <span className={styles.diffBefore}>{op.before}</span>
                  <span className={styles.diffArrow}>→</span>
                  <span className={styles.diffAfter}>{op.after}</span>
                </span>
                <span className={styles.opReason}>{op.reason}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {!applied && ops.length > 0 && (
        <button className="btn primary" onClick={apply}>
          <Check size={14} /> 应用选中的 {selected.size} 项
        </button>
      )}
      {applied && (
        <button className="btn" onClick={onClose}>完成，返回编辑器</button>
      )}
    </div>
  );
}
