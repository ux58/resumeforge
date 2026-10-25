import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** 简历全文（zod 校验后的 ResumeData） */
    data: jsonb("data").notNull(),
    template: text("template").notNull().default("clean"),
    theme: text("theme").notNull().default("blue"),
    shareToken: text("share_token").unique(),
    shareEnabled: boolean("share_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resumes_user_idx").on(t.userId)],
);

/** 简历版本快照：每次保存/优化/回退都落一条，可追溯可回退 */
export const resumeVersions = pgTable(
  "resume_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    data: jsonb("data").notNull(),
    template: text("template").notNull(),
    theme: text("theme").notNull(),
    /** edit=手动编辑 / autosave=自动保存 / optimize=一键优化 / rollback=版本回退 / create=初始 */
    source: text("source").notNull().default("edit"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resume_versions_resume_idx").on(t.resumeId, t.createdAt)],
);

/** 职位库：用户粘贴/智能识别的招聘信息（含福利标签），用于匹配分析 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    city: text("city").notNull().default(""),
    salaryText: text("salary_text").notNull().default(""),
    salaryMinK: integer("salary_mink"),
    salaryMaxK: integer("salary_maxk"),
    /** 福利标签数组：五险一金 / 双休 / 远程办公 / 弹性工作 / 股票期权 … */
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
    experienceReq: text("experience_req").notNull().default(""),
    educationReq: text("education_req").notNull().default(""),
    jdText: text("jd_text").notNull().default(""),
    channel: text('channel').notNull().default('其他'),
    source: text('source').notNull().default('manual'),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("jobs_user_idx").on(t.userId)],
);
