"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson, apiJsonBody } from "@/shared/api-client";
import { toast } from "@/components/toast";
import styles from "./auth.module.scss";

export function LoginForm() {
  const router = useRouter();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<{ initialized: boolean }>("/api/auth/setup")
      .then((r) => setInitialized(r.initialized))
      .catch(() => setInitialized(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (initialized === false) {
        await apiJsonBody("POST", "/api/auth/setup", { username, password });
        toast.ok("管理员已创建");
      } else {
        await apiJsonBody("POST", "/api/auth/login", { username, password });
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      toast.err(err instanceof Error ? err.message : "操作失败");
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className="field">
        <label htmlFor="username">用户名</label>
        <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={40} />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={initialized === false ? "new-password" : "current-password"}
          required
          minLength={initialized === false ? 8 : 1}
        />
        {initialized === false && <span className={styles.hint}>首次使用：此账号将初始化为管理员（密码 ≥ 8 位）</span>}
      </div>
      <button className="btn primary" disabled={busy || initialized === null}>
        {busy ? "处理中…" : initialized === false ? "初始化管理员并进入" : "登录"}
      </button>
    </form>
  );
}
