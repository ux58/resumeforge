"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileText, Plus, Share2, Trash2, Gauge } from "lucide-react";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { toast } from "@/components/toast";
import { analyzeResume } from "@/features/analysis/engine";
import type { ResumeDto } from "@/features/resumes/service";
import styles from "./dashboard.module.scss";

const TEMPLATE_NAMES: Record<string, string> = { clean: "简约", classic: "经典", twocol: "双栏" };

export function DashboardList({ initial }: { initial: ResumeDto[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const created = await apiJsonBody<ResumeDto>("POST", "/api/resumes", {
        title: `我的简历 ${new Date().toLocaleDateString("zh-CN")}`,
      });
      router.push(`/editor/${created.id}`);
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "创建失败");
      setCreating(false);
    }
  }

  async function copyOne(item: ResumeDto) {
    try {
      const created = await apiJsonBody<ResumeDto>("POST", "/api/resumes", {
        title: `${item.title}（副本）`,
        data: item.data,
        template: item.template,
        theme: item.theme,
      });
      setItems((prev) => [created, ...prev]);
      toast.ok("已复制");
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "复制失败");
    }
  }

  async function removeOne(item: ResumeDto) {
    if (!confirm(`删除「${item.title}」？此操作不可恢复。`)) return;
    try {
        await apiJson(`/api/resumes/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((r) => r.id !== item.id));
      toast.ok("已删除");
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function toggleShare(item: ResumeDto) {
    try {
      const updated = await apiJsonBody<ResumeDto>("POST", `/api/resumes/${item.id}`, { enabled: !item.shareEnabled });
      setItems((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      if (updated.shareUrl) {
        const url = `${location.origin}${updated.shareUrl}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.ok(`分享已开启，链接已复制：${url}`);
      } else {
        toast.info("分享已关闭");
      }
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "操作失败");
    }
  }

  return (
    <div>
      <div className={styles.head}>
        <h1>我的简历 <span className={styles.count}>{items.length}</span></h1>
        <button className="btn primary" onClick={create} disabled={creating}>
          <Plus size={15} strokeWidth={2.4} /> 新建简历
        </button>
      </div>

      {items.length === 0 ? (
        <div className={`${styles.empty} card`}>
          <FileText size={30} strokeWidth={1.6} />
          <p>还没有简历。点击「新建简历」，2 分钟完成一份可打印的专业简历。</p>
          <button className="btn primary" onClick={create} disabled={creating}>
            <Plus size={15} strokeWidth={2.4} /> 立即创建
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item, i) => (
            <ResumeCard key={item.id} item={item} index={i} onCopy={copyOne} onDelete={removeOne} onShare={toggleShare} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeCard({
  item,
  index,
  onCopy,
  onDelete,
  onShare,
}: {
  item: ResumeDto;
  index: number;
  onCopy: (item: ResumeDto) => void;
  onDelete: (item: ResumeDto) => void;
  onShare: (item: ResumeDto) => void;
}) {
  const score = useMemo(() => analyzeResume(item.data).total, [item.data]);
  const scoreTone = score >= 80 ? styles.good : score >= 60 ? styles.mid : styles.low;

  return (
    <article className={`${styles.cardCard} card`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className={styles.scoreRow}>
        <span className={`${styles.score} ${scoreTone}`} title="简历评分">
          <Gauge size={14} strokeWidth={2.2} /> {score}
        </span>
        <span className={styles.meta}>{TEMPLATE_NAMES[item.template] ?? item.template} · {new Date(item.updatedAt).toLocaleDateString("zh-CN")}</span>
      </div>
      <Link href={`/editor/${item.id}`} className={styles.title}>
        {item.title}
      </Link>
      <p className={styles.subline}>{item.data.basics.name || "未填姓名"}{item.data.basics.headline && ` · ${item.data.basics.headline}`}</p>
      <div className={styles.ops}>
        <button className="btn" onClick={() => onCopy(item)}><Copy size={13} /> 复制</button>
        <button className="btn" onClick={() => onShare(item)}><Share2 size={13} /> {item.shareEnabled ? "关闭分享" : "分享"}</button>
        <button className="btn danger" onClick={() => onDelete(item)}><Trash2 size={13} /> 删除</button>
      </div>
    </article>
  );
}
