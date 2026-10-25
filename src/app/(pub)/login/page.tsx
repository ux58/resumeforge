import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { LoginForm } from "./form";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./auth.module.scss";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return (
    <main className={styles.wrap}>
      <div className={styles.themeCorner}><ThemeToggle /></div>
      <div className={`${styles.card} card`}>
        <div className={styles.badge}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </div>
        <h1>ResumeForge</h1>
        <p className={styles.sub}>在线简历工坊 · 制作 / 优化 / 可视化 / 导出</p>
        <LoginForm />
      </div>
    </main>
  );
}
