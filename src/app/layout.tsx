import type { Metadata } from "next";
import "./globals.scss";
import { ToastHost } from "@/components/toast";

export const metadata: Metadata = {
  title: "ResumeForge 简历工坊",
  description: "在线简历制作与优化：多模板实时预览、六维评分、JD 关键词匹配、一键打印导出",
};

/** 首帧前应用主题 + 全局错误捕获（错误持久化到 sessionStorage，跨重载可查） */
const themeInitScript = [
  "(function(){",
  "try{var t=localStorage.getItem('rf-theme')||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}",
  "window.addEventListener('error',function(e){try{sessionStorage.setItem('rf-err',(e.message||'?')+' @ '+(e.filename||'')+':'+(e.lineno||0))}catch(_){}});",
  "window.addEventListener('unhandledrejection',function(e){try{sessionStorage.setItem('rf-err','REJECTION: '+String(e.reason&&(e.reason.stack||e.reason)||e.reason).slice(0,500))}catch(_){}});",
  "var oce=console.error;console.error=function(){try{sessionStorage.setItem('rf-cerr',(sessionStorage.getItem('rf-cerr')||'')+'\\n'+Array.prototype.map.call(arguments,function(x){return (x&&(x.stack||x.message))||String(x)}).join(' ').slice(0,400))}catch(_){}};",
  "try{sessionStorage.setItem('rf-loaded',String(Date.now()))}catch(_){}",
  "})();",
].join("\n");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
