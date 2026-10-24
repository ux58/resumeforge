import Link from "next/link";
import { FileText } from "lucide-react";
import { getByShareToken } from "@/features/resumes/service";
import { ResumePreview } from "@/components/resume-preview";
import styles from "./share.module.scss";

export const metadata = { title: "简历分享 · ResumeForge" };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const resume = await getByShareToken((await params).token);

  if (!resume) {
    return (
      <main className={styles.wrap}>
        <div className={`${styles.card} card`}>
          <FileText size={30} strokeWidth={1.6} />
          <h1>链接无效或已关闭</h1>
          <p>这份简历的分享链接不存在，或已被作者关闭。</p>
          <Link href="/login" className="btn primary">前往 ResumeForge</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.topbar}>
        <span className={styles.brand}>ResumeForge 分享</span>
        <span className={styles.meta}>{resume.data.basics.name || resume.title} 的简历 · 只读</span>
      </div>
      <div className={styles.paperArea}>
        <ResumePreview data={resume.data} template={resume.template} theme={resume.theme} />
      </div>
    </main>
  );
}
