import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  VALIDATION: "validation_error",
  CONFLICT: "conflict",
  INTERNAL: "internal_error",
} as const;

export function jsonError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return NextResponse.json({ error: { code: ERROR_CODES.VALIDATION, message: msg } }, { status: 422 });
  }
  console.error("[api]", err);
  return NextResponse.json({ error: { code: ERROR_CODES.INTERNAL, message: "服务内部错误" } }, { status: 500 });
}
