import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { listVersions } from "@/features/resumes/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    return NextResponse.json({ items: await listVersions(user.id, (await ctx.params).id) });
  } catch (err) {
    return jsonError(err);
  }
}
