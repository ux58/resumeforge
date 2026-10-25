import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { FileText } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScrollArea } from "@/components/scroll-area";
import { LogoutButton } from "./logout-button";
import styles from "./app.module.scss";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <a href="/dashboard" className={styles.brand} aria-label="返回仪表盘">
          <FileText size={16} strokeWidth={2.2} />
          ResumeForge
        </a>
        <nav className={styles.nav} aria-label="主导航">
          <a href="/dashboard">我的简历</a>
          <a href="/jobs">职位匹配</a>
        </nav>
        <span className={styles.spacer} />
        <ThemeToggle />
        <span className={styles.user}>{user.username}</span>
        <LogoutButton />
      </header>
      <ScrollArea className={styles.main} ariaLabel="页面主内容">
        {children}
      </ScrollArea>
    </div>
  );
}
