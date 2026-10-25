import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { getVersionData } from "@/features/resumes/service";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

/** 取某个历史版本的完整快照（用于预览/回退） */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id, versionId } = await ctx.params;
    return NextResponse.json(await getVersionData(user.id, id, versionId));
  } catch (err) {
    return jsonError(err);
  }
}
