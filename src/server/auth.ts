import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "@/server/db";
import { ApiError, ERROR_CODES } from "@/server/http";

export const SESSION_COOKIE = "rf_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 天

export interface SessionUser {
  id: string;
  username: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 创建用户（初始化与注册共用；唯一冲突抛 409） */
export async function createUser(username: string, password: string): Promise<SessionUser> {
  const db = getDb();
  const hash = await bcrypt.hash(password, 12);
  try {
    const [row] = await db
      .insert(schema.users)
      .values({ username, passwordHash: hash })
      .returning({ id: schema.users.id, username: schema.users.username });
    return row;
  } catch {
    throw new ApiError(409, ERROR_CODES.CONFLICT, "用户名已被占用");
  }
}

export async function verifyLogin(username: string, password: string): Promise<SessionUser> {
  const db = getDb();
  const [row] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  // 统一错误信息，不区分用户不存在/密码错误
  if (!row || !(await bcrypt.compare(password, row.passwordHash))) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "用户名或密码错误");
  }
  return { id: row.id, username: row.username };
}

/** 签发会话：随机 token 落库（仅存哈希）+ HttpOnly Cookie */
export async function issueSession(userId: string): Promise<void> {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb().delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** 服务端组件/路由共用：未登录返回 null（页面跳转用），路由用 requireUser 抛 401 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, "未认证：请先登录");
  return user;
}
