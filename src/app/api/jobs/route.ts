import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { createJob, ensureSampleJobs, listJobs } from "@/features/jobs/service";
import { jobCreateSchema } from "@/features/jobs/schema";

export async function GET() {
  try {
    const user = await requireUser();
    await ensureSampleJobs(user.id); // 首次访问预置示例职位
    return NextResponse.json({ items: await listJobs(user.id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = jobCreateSchema.parse(await req.json());
    return NextResponse.json(await createJob(user.id, input), { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
