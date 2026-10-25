"use client";

import { useState } from "react";
import { FileUp, X } from "lucide-react";
import { parseResumeText } from "@/features/resumes/import";
import type { ResumeData } from "@/features/resumes/schema";
import { toast } from "@/components/toast";
import { ScrollArea } from "@/components/scroll-area";
import styles from "./panels.module.scss";

/** 导入简历：粘贴纯文本 → 启发式解析 → 预览识别结果 → 合并进表单 */
export function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (data: ResumeData, warnings: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof parseResumeText> | null>(null);

  function doParse() {
    if (text.trim().length < 30) {
      toast.err("内容太短，请粘贴完整简历文本");
      return;
    }
    const r = parseResumeText(text);
    setResult(r);
    if (r.warnings.length) toast.info(`解析完成，${r.warnings.length} 项需要人工确认`);
    else toast.ok("解析完成，请核对后导入");
  }

  function doImport() {
    if (!result) return;
    onImport(result.data, result.warnings);
    onClose();
  }

  return (
    <div className={styles.mask} onClick={onClose}>
      <div className={`${styles.dialog} card`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHead}>
          <h3><FileUp size={15} /> 导入简历文本</h3>
          <button className="btn" onClick={onClose} aria-label="关闭"><X size={15} /></button>
        </div>
        <div className={styles.dialogScroll}>
        <ScrollArea className={styles.dialogScrollArea} ariaLabel="导入内容">
        <p className={styles.hint}>
          粘贴任意格式的简历纯文本（支持从 Word/PDF 复制），系统按标题分节与日期区间启发式解析，
          结果进入左侧表单供人工核对——不会直接覆盖保存。
        </p>
        <textarea
          className={styles.importArea}
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"陈晓\n高级后端工程师\n邮箱：chen@example.com  手机：138xxxx\n\n工作经历\n星河科技 高级后端工程师 2021.07 - 至今\n- 主导支付网关重构，P99 延迟降低 85%\n\n教育经历\n浙江大学 本科 2014-2018"}
        />
        {result && (
          <div className={styles.importResult}>
            <div className={styles.kv}>
              <span>姓名：{result.data.basics.name || "未识别"}</span>
              <span>邮箱：{result.data.basics.email || "未识别"}</span>
              <span>手机：{result.data.basics.phone || "未识别"}</span>
              <span>工作经历：{result.data.experience.length} 段</span>
              <span>教育：{result.data.education.length} 条</span>
              <span>技能：{result.data.skills.length} 项</span>
              <span>项目：{result.data.projects.length} 个</span>
            </div>
            {result.warnings.length > 0 && (
              <ul className={styles.warnList}>
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}
        </ScrollArea>
        </div>
        {result && (
          <div className={styles.importActions}>
            <button className="btn" onClick={() => setResult(null)}>重新解析</button>
            <button className="btn primary" onClick={doImport}>导入到表单（不直接保存）</button>
          </div>
        )}
        {!result && <button className="btn primary" onClick={doParse}>解析文本</button>}
      </div>
    </div>
  );
}
