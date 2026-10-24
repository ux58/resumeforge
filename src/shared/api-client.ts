"use client";

/** 浏览器端 API 封装：统一错误信封 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch { /* 非 JSON 响应体 */ }
    throw new ApiClientError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiJsonBody<T>(method: string, path: string, data: unknown): Promise<T> {
  return apiJson<T>(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
