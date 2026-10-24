import { z } from "zod";

/** 简历正文（jsonb 存储，前后端共享校验） */

export const basicsSchema = z.object({
  name: z.string().trim().max(50).default(""),
  headline: z.string().trim().max(100).default(""),
  email: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(80).default(""),
  website: z.string().trim().max(200).default(""),
  summary: z.string().trim().max(800).default(""),
});

export const educationSchema = z.object({
  school: z.string().trim().max(80).default(""),
  degree: z.string().trim().max(40).default(""),
  field: z.string().trim().max(60).default(""),
  start: z.string().trim().max(20).default(""),
  end: z.string().trim().max(20).default(""),
  desc: z.string().trim().max(600).default(""),
});

export const experienceSchema = z.object({
  company: z.string().trim().max(80).default(""),
  role: z.string().trim().max(60).default(""),
  start: z.string().trim().max(20).default(""),
  end: z.string().trim().max(20).default(""),
  bullets: z.string().trim().max(2000).default(""),
});

export const projectSchema = z.object({
  name: z.string().trim().max(80).default(""),
  role: z.string().trim().max(60).default(""),
  link: z.string().trim().max(200).default(""),
  tech: z.string().trim().max(200).default(""),
  desc: z.string().trim().max(1200).default(""),
});

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(40),
  level: z.number().int().min(1).max(5).default(3),
});

export const certSchema = z.object({
  name: z.string().trim().max(120).default(""),
  issuer: z.string().trim().max(80).default(""),
  date: z.string().trim().max(20).default(""),
});

export const customSectionSchema = z.object({
  title: z.string().trim().min(1).max(40),
  content: z.string().trim().max(2000).default(""),
});

export const resumeDataObject = z.object({
  basics: basicsSchema,
  targetJob: z.string().trim().max(2000).default(""),
  education: z.array(educationSchema).max(10),
  experience: z.array(experienceSchema).max(15),
  projects: z.array(projectSchema).max(15),
  skills: z.array(skillSchema).max(40),
  certs: z.array(certSchema).max(15),
  customs: z.array(customSectionSchema).max(6),
});

/**
 * Zod 4 的 .default() 不再解析默认值（嵌套对象会原样返回导致内层缺字段），
 * 改为 preprocess 深度补空：任何缺失的容器字段补为空对象/空数组，再交给字段级 default。
 */
export const resumeDataSchema = z.preprocess((v) => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    basics: o.basics ?? {},
    targetJob: o.targetJob ?? "",
    education: o.education ?? [],
    experience: o.experience ?? [],
    projects: o.projects ?? [],
    skills: o.skills ?? [],
    certs: o.certs ?? [],
    customs: o.customs ?? [],
  };
}, resumeDataObject);

export const TEMPLATE_IDS = ["clean", "classic", "twocol"] as const;
export const THEME_IDS = ["blue", "teal", "slate", "wine"] as const;

export const resumeCreateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  data: resumeDataSchema.optional(),
  template: z.enum(TEMPLATE_IDS).default("clean"),
  theme: z.enum(THEME_IDS).default("blue"),
});

export const resumeUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  data: resumeDataSchema.optional(),
  template: z.enum(TEMPLATE_IDS).optional(),
  theme: z.enum(THEME_IDS).optional(),
});

export const resumeRowSchema = z.object({
  shareEnabled: z.boolean().optional(),
});

export type ResumeData = z.infer<typeof resumeDataSchema>;
export type ResumeBasics = z.infer<typeof basicsSchema>;
export type EducationItem = z.infer<typeof educationSchema>;
export type ExperienceItem = z.infer<typeof experienceSchema>;
export type ProjectItem = z.infer<typeof projectSchema>;
export type SkillItem = z.infer<typeof skillSchema>;
export type CertItem = z.infer<typeof certSchema>;
export type CustomSection = z.infer<typeof customSectionSchema>;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type ThemeId = (typeof THEME_IDS)[number];

export const EMPTY_RESUME: ResumeData = {
  basics: { name: "", headline: "", email: "", phone: "", location: "", website: "", summary: "" },
  targetJob: "",
  education: [],
  experience: [],
  projects: [],
  skills: [],
  certs: [],
  customs: [],
};
