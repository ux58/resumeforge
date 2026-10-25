import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { jsonError } from "@/server/http";
import { deleteResume, getResume, setShare, updateResume } from "@/features/resumes/service";
import { resumeUpdateSchema } from "@/features/resumes/schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    return NextResponse.json(await getResume(user.id, (await ctx.params).id));
  } catch (err) {
    return jsonError(err);
  }
}

const patchWithSource = resumeUpdateSchema.extend({
  source: z.enum(["edit", "autosave", "optimize", "rollback"]).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { source, ...patch } = patchWithSource.parse(await req.json());
    return NextResponse.json(await updateResume(user.id, (await ctx.params).id, patch, source ?? "edit"));
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    await deleteResume(user.id, (await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}

const shareSchema = z.object({ enabled: z.boolean() });

/** 开启/关闭只读分享（开启时生成随机 token） */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { enabled } = shareSchema.parse(await req.json());
    return NextResponse.json(await setShare(user.id, (await ctx.params).id, enabled));
  } catch (err) {
    return jsonError(err);
  }
}
