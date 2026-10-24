import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { ApiError, ERROR_CODES } from "@/server/http";
import type { ResumeData, TemplateId, ThemeId } from "./schema";
import { resumeDataSchema } from "./schema";

export interface ResumeDto {
  id: string;
  title: string;
  data: ResumeData;
  template: TemplateId;
  theme: ThemeId;
  shareEnabled: boolean;
  shareToken: string | null;
  shareUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDto(row: typeof schema.resumes.$inferSelect): ResumeDto {
  const parsed = resumeDataSchema.safeParse(row.data);
  return {
    id: row.id,
    title: row.title,
    data: parsed.success ? parsed.data : resumeDataSchema.parse({}),
    template: row.template as TemplateId,
    theme: row.theme as ThemeId,
    shareEnabled: row.shareEnabled,
    shareToken: row.shareToken,
    shareUrl: row.shareEnabled && row.shareToken ? `/share/${row.shareToken}` : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listResumes(userId: string): Promise<ResumeDto[]> {
  const rows = await getDb()
    .select()
    .from(schema.resumes)
    .where(eq(schema.resumes.userId, userId))
    .orderBy(desc(schema.resumes.updatedAt));
  return rows.map(toDto);
}

export async function getResume(userId: string, id: string): Promise<ResumeDto> {
  const [row] = await getDb()
    .select()
    .from(schema.resumes)
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)))
    .limit(1);
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "简历不存在");
  return toDto(row);
}

export async function createResume(
  userId: string,
  input: { title: string; data?: ResumeData; template: TemplateId; theme: ThemeId },
): Promise<ResumeDto> {
  const [row] = await getDb()
    .insert(schema.resumes)
    .values({ userId, title: input.title, data: input.data ?? resumeDataSchema.parse({}), template: input.template, theme: input.theme })
    .returning();
  return toDto(row);
}

export async function updateResume(
  userId: string,
  id: string,
  patch: { title?: string; data?: ResumeData; template?: TemplateId; theme?: ThemeId },
): Promise<ResumeDto> {
  await getResume(userId, id); // 404 / 归属校验
  const [row] = await getDb()
    .update(schema.resumes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)))
    .returning();
  return toDto(row);
}

export async function deleteResume(userId: string, id: string): Promise<void> {
  const result = await getDb()
    .delete(schema.resumes)
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)))
    .returning({ id: schema.resumes.id });
  if (!result.length) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "简历不存在");
}

export async function setShare(userId: string, id: string, enabled: boolean): Promise<ResumeDto> {
  await getResume(userId, id);
  const shareToken = enabled ? randomBytes(16).toString("base64url") : null;
  const [row] = await getDb()
    .update(schema.resumes)
    .set({ shareEnabled: enabled, shareToken, updatedAt: new Date() })
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)))
    .returning();
  return toDto(row);
}

/** 分享页/打印场景：仅凭 token 读取（未登录） */
export async function getByShareToken(token: string): Promise<ResumeDto | null> {
  const [row] = await getDb()
    .select()
    .from(schema.resumes)
    .where(and(eq(schema.resumes.shareToken, token), eq(schema.resumes.shareEnabled, true)))
    .limit(1);
  return row ? toDto(row) : null;
}
