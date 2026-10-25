import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import type { JobCreateInput, JobDto } from "./schema";

/** 示例职位库：22 个国内典型岗位，覆盖主流渠道与城市；随版本升级自动同步到用户职位库 */


function toDto(row: typeof schema.jobs.$inferSelect): JobDto {
  return {
    id: row.id,
    channel: row.channel,
    company: row.company,
    role: row.role,
    city: row.city,
    salaryText: row.salaryText,
    salaryMinK: row.salaryMinK,
    salaryMaxK: row.salaryMaxK,
    benefits: row.benefits ?? [],
    experienceReq: row.experienceReq,
    educationReq: row.educationReq,
    jdText: row.jdText,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listJobs(userId: string): Promise<JobDto[]> {
  const rows = await getDb()
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId))
    .orderBy(desc(schema.jobs.createdAt));
  return rows.map(toDto);
}

export async function createJob(userId: string, input: JobCreateInput): Promise<JobDto> {
  const [row] = await getDb()
    .insert(schema.jobs)
    .values({
      channel: input.channel,
      userId,
      company: input.company,
      role: input.role,
      city: input.city,
      salaryText: input.salaryText,
      salaryMinK: input.salaryMinK ?? null,
      salaryMaxK: input.salaryMaxK ?? null,
      benefits: input.benefits,
      experienceReq: input.experienceReq,
      educationReq: input.educationReq,
      jdText: input.jdText,
      source: input.source,
    })
    .returning();
  return toDto(row);
}

export async function deleteJob(userId: string, id: string): Promise<void> {
  const result = await getDb()
    .delete(schema.jobs)
    .where(and(eq(schema.jobs.id, id), eq(schema.jobs.userId, userId)))
    .returning({ id: schema.jobs.id });
  if (!result.length) throw new Error("职位不存在");
}


