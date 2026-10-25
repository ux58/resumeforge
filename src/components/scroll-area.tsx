"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 悬浮滚动条容器：内容真实可滚（滚轮/键盘/触摸原生行为），
 * 自绘拇指悬浮于右侧，不占布局宽度。支持拖拽拇指滚动。
 */
export function ScrollArea({
  children,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumb, setThumb] = useState({ height: 0, y: 0, has: false });

  const update = useCallback(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const sh = content.scrollHeight;
    const ch = wrap.clientHeight;
    if (sh <= ch + 1) {
      setThumb({ height: 0, y: 0, has: false });
      return;
    }
    const height = Math.max(30, (ch / sh) * ch);
    const y = (content.scrollTop / (sh - ch)) * (ch - height);
    setThumb({ height, y, has: true });
  }, []);

  // 内容/容器尺寸变化时重算
  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const ro = new ResizeObserver(update);
    ro.observe(content);
    ro.observe(wrap);
    window.addEventListener("resize", update);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  // 滚动时显示拇指，停止 900ms 后隐藏
  const onScroll = useCallback(() => {
    update();
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.classList.add("scrolling");
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => wrap.classList.remove("scrolling"), 900);
  }, [update]);

  const startDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const content = contentRef.current;
      const thumb = thumbRef.current;
      if (!content || !thumb) return;
      const sh = content.scrollHeight;
      const ch = wrapRef.current!.clientHeight;
      const height = Math.max(30, (ch / sh) * ch);
      dragRef.current = { startY: e.clientY, startScroll: content.scrollTop };
      thumb.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) => {
        if (!dragRef.current || !contentRef.current) return;
        const dy = ev.clientY - dragRef.current.startY;
        const wrap = wrapRef.current!;
        const maxScroll = sh - ch;
        const maxThumb = wrap.clientHeight - height;
        const next = dragRef.current.startScroll + (dy / Math.max(1, maxThumb)) * maxScroll;
        content.scrollTop = Math.max(0, Math.min(maxScroll, next));
      };
      const up = () => {
        dragRef.current = null;
        thumb.releasePointerCapture(e.pointerId);
        thumb.removeEventListener("pointermove", move);
        thumb.removeEventListener("pointerup", up);
      };
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", up);
    },
    [],
  );

  return (
    <div ref={wrapRef} className={`scroll-area ${className}`} aria-label={ariaLabel} onScroll={onScroll}>
      <div ref={contentRef} className="scroll-area-content">
        {children}
      </div>
      {thumb.has && (
        <div className="scroll-area-track" aria-hidden>
          <div
            ref={thumbRef}
            className="scroll-area-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.y}px)` }}
            onPointerDown={startDrag}
            role="presentation"
          />
        </div>
      )}
    </div>
  );
}
