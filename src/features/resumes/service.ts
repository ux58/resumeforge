import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
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

/** 版本来源标签 */
export type VersionSource = "create" | "edit" | "autosave" | "optimize" | "rollback";

const VERSION_CAP = 50;

/** 每次变更落一条版本快照；超出上限裁剪最旧记录 */
async function recordVersion(row: typeof schema.resumes.$inferSelect, source: VersionSource): Promise<void> {
  const db = getDb();
  await db.insert(schema.resumeVersions).values({
    resumeId: row.id,
    title: row.title,
    data: row.data,
    template: row.template,
    theme: row.theme,
    source,
  });
  const olds = await db
    .select({ id: schema.resumeVersions.id })
    .from(schema.resumeVersions)
    .where(eq(schema.resumeVersions.resumeId, row.id))
    .orderBy(desc(schema.resumeVersions.createdAt));
  const stale = olds.slice(VERSION_CAP).map((r) => r.id);
  if (stale.length) {
    await db.delete(schema.resumeVersions).where(inArray(schema.resumeVersions.id, stale));
  }
}

export interface VersionDto {
  id: string;
  title: string;
  template: TemplateId;
  theme: ThemeId;
  source: string;
  createdAt: string;
}

export async function listVersions(userId: string, resumeId: string): Promise<VersionDto[]> {
  await getResume(userId, resumeId); // 归属校验
  const rows = await getDb()
    .select({
      id: schema.resumeVersions.id,
      title: schema.resumeVersions.title,
      template: schema.resumeVersions.template,
      theme: schema.resumeVersions.theme,
      source: schema.resumeVersions.source,
      createdAt: schema.resumeVersions.createdAt,
    })
    .from(schema.resumeVersions)
    .where(eq(schema.resumeVersions.resumeId, resumeId))
    .orderBy(desc(schema.resumeVersions.createdAt))
    .limit(VERSION_CAP);
  return rows.map((r) => ({
    ...r,
    template: r.template as TemplateId,
    theme: r.theme as ThemeId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getVersionData(userId: string, resumeId: string, versionId: string): Promise<ResumeDto | null> {
  await getResume(userId, resumeId);
  const [row] = await getDb()
    .select()
    .from(schema.resumeVersions)
    .where(and(eq(schema.resumeVersions.id, versionId), eq(schema.resumeVersions.resumeId, resumeId)))
    .limit(1);
  if (!row) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "版本不存在");
  const parsed = resumeDataSchema.safeParse(row.data);
  return {
    id: resumeId,
    title: row.title,
    data: parsed.success ? parsed.data : resumeDataSchema.parse({}),
    template: row.template as TemplateId,
    theme: row.theme as ThemeId,
    shareEnabled: false,
    shareToken: null,
    shareUrl: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(),
  };
}

export async function createResume(
  userId: string,
  input: { title: string; data?: ResumeData; template: TemplateId; theme: ThemeId },
): Promise<ResumeDto> {
  const [row] = await getDb()
    .insert(schema.resumes)
    .values({ userId, title: input.title, data: input.data ?? resumeDataSchema.parse({}), template: input.template, theme: input.theme })
    .returning();
  await recordVersion(row, "create");
  return toDto(row);
}

export async function updateResume(
  userId: string,
  id: string,
  patch: { title?: string; data?: ResumeData; template?: TemplateId; theme?: ThemeId },
  source: VersionSource = "edit",
): Promise<ResumeDto> {
  await getResume(userId, id); // 404 / 归属校验
  const [row] = await getDb()
    .update(schema.resumes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schema.resumes.id, id), eq(schema.resumes.userId, userId)))
    .returning();
  await recordVersion(row, source);
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
