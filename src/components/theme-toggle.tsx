"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import styles from "./theme-toggle.module.scss";

const KEY = "rf-theme";
type Theme = "dark" | "light";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function apply(t: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch { /* 隐私模式忽略 */ }
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

/** 顶栏主题切换按钮：双主题图标 + 状态持久化 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // rAF 应用避免 effect 内同步 setState 触发级联渲染
    const id = requestAnimationFrame(() => {
      setTheme(currentTheme());
      setMounted(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    apply(next);
    setTheme(next);
  }

  return (
    <button className="btn" onClick={toggle} aria-label={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"} title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}>
      {mounted && theme === "dark" ? <Sun size={14} strokeWidth={2.2} /> : <Moon size={14} strokeWidth={2.2} />}
      <span className={styles.label}>{mounted && theme === "dark" ? "亮色" : "暗色"}</span>
    </button>
  );
}
