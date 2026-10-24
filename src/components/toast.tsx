"use client";

import { create } from "zustand";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import styles from "./toast.module.scss";

interface ToastItem {
  id: number;
  kind: "ok" | "err" | "info";
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastItem["kind"], message: string) => void;
  remove: (id: number) => void;
}

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (kind, message) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3500);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  ok: (m: string) => useToastStore.getState().push("ok", m),
  err: (m: string) => useToastStore.getState().push("err", m),
  info: (m: string) => useToastStore.getState().push("info", m),
};

const ICONS = { ok: CheckCircle2, err: AlertCircle, info: Info } as const;

export function ToastHost() {
  const { items, remove } = useToastStore();
  if (!items.length) return null;
  return (
    <div className={styles.host} role="status" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={`${styles.item} ${styles[t.kind]}`} onClick={() => remove(t.id)}>
            <Icon size={15} strokeWidth={2.2} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
