import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth";
import { jsonError, ApiError, ERROR_CODES } from "@/server/http";
import { deleteJob } from "@/features/jobs/service";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    await deleteJob(user.id, (await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message === "职位不存在") {
      return jsonError(new ApiError(404, ERROR_CODES.NOT_FOUND, err.message));
    }
    return jsonError(err);
  }
}
