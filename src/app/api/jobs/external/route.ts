import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { fetchExternalJobs } from "@/features/jobs/external";

/** 真实数据源：RemoteOK + Arbeitnow 官方开放 API（实时拉取，30 分钟缓存） */
export async function GET() {
  try {
    await requireUser();
    const jobs = await fetchExternalJobs();
    return NextResponse.json({ items: jobs, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return jsonError(err);
  }
}
