import type { Metadata } from "next";
import "./globals.scss";
import { ToastHost } from "@/components/toast";

export const metadata: Metadata = {
  title: "ResumeForge 简历工坊",
  description: "在线简历制作与优化：多模板实时预览、六维评分、JD 关键词匹配、一键打印导出",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
