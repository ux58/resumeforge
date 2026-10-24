import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { FileText } from "lucide-react";
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
        <span className={styles.user}>{user.username}</span>
        <LogoutButton />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
