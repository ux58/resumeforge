import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { createJob, listJobs } from "@/features/jobs/service";
import { jobCreateSchema } from "@/features/jobs/schema";

export async function GET() {
  try {
    const user = await requireUser();
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
