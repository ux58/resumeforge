import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/server/db";
import { createUser, getSessionUser, issueSession } from "@/server/auth";
import { jsonError, ApiError, ERROR_CODES } from "@/server/http";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(100),
});

export async function GET() {
  const count = (await getDb().select({ id: schema.users.id }).from(schema.users).limit(1)).length;
  const user = await getSessionUser();
  return NextResponse.json({ initialized: count > 0, authed: !!user });
}

/** 首个用户开放注册；之后仅已登录用户可追加账号 */
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const count = (await db.select({ id: schema.users.id }).from(schema.users).limit(1)).length;
    const { username, password } = credentialsSchema.parse(await req.json());
    if (count > 0) {
      const user = await getSessionUser();
      if (!user) throw new ApiError(403, ERROR_CODES.FORBIDDEN, "系统已初始化，禁止匿名创建账号");
    }
    const user = await createUser(username, password);
    await issueSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
