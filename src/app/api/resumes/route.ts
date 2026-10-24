import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { createResume, listResumes } from "@/features/resumes/service";
import { resumeCreateSchema } from "@/features/resumes/schema";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ items: await listResumes(user.id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = resumeCreateSchema.parse(await req.json());
    return NextResponse.json(await createResume(user.id, input), { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
