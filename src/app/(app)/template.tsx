import styles from "./app.module.scss";

/** 路由转场：每次导航内容区淡入上浮（顶栏在 layout 常驻不动） */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className={styles.pageEnter}>{children}</div>;
}
