"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiJson } from "@/shared/api-client";
import { toast } from "@/components/toast";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn"
      aria-label="退出登录"
      title="退出登录"
      onClick={async () => {
        try {
          await apiJson("/api/auth/login", { method: "DELETE" });
          router.replace("/login");
          router.refresh();
        } catch {
          toast.err("退出失败");
        }
      }}
    >
      <LogOut size={14} strokeWidth={2.2} />
      退出
    </button>
  );
}
