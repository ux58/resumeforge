import { z } from "zod";

export const KNOWN_BENEFITS = [
  "五险一金",
  "六险一金",
  "双休",
  "大小周",
  "弹性工作",
  "远程办公",
  "股票期权",
  "年终奖",
  "带薪年假",
  "餐补",
  "交通补贴",
  "加班补贴",
  "定期体检",
  "免费班车",
  "住房补贴",
] as const;

export const jobCreateSchema = z.object({
  company: z.string().trim().max(80).default(""),
  role: z.string().trim().max(60).default(""),
  city: z.string().trim().max(40).default(""),
  salaryText: z.string().trim().max(40).default(""),
  salaryMinK: z.number().int().min(0).max(1000).nullable().optional(),
  salaryMaxK: z.number().int().min(0).max(1000).nullable().optional(),
  benefits: z.array(z.string().trim().max(20)).max(20).default([]),
  experienceReq: z.string().trim().max(60).default(""),
  educationReq: z.string().trim().max(60).default(""),
  jdText: z.string().trim().max(20000).default(""),
  channel: z.enum(['BOSS直聘','猎聘','智联招聘','前程无忧','拉勾','脉脉','内推','官网','其他']).default('其他'),
  source: z.enum(['manual', 'sample', 'extract']).default('manual'),
});

export const jobUpdateSchema = jobCreateSchema.partial().omit({ source: true });

export type JobCreateInput = z.infer<typeof jobCreateSchema>;
export type JobDto = {
  id: string;
  channel: string;
  company: string;
  role: string;
  city: string;
  salaryText: string;
  salaryMinK: number | null;
  salaryMaxK: number | null;
  benefits: string[];
  experienceReq: string;
  educationReq: string;
  jdText: string;
  source: string;
  createdAt: string;
};

/** 从粘贴的 JD 原文中智能识别：薪资区间 / 城市 / 福利标签 / 经验学历要求 */
export function extractJobFromText(rawText: string, companyFallback = ""): JobCreateInput {
  const text = rawText.trim();
  const out: JobCreateInput = { company: companyFallback, role: "", city: "", salaryText: "", benefits: [], experienceReq: "", educationReq: "", jdText: text, channel: "其他", source: "extract" };

  // 薪资：25-40K / 20k-35k / 15-25K·14薪 / 2万-3.5万
  const salaryMatch = text.match(/(\d{1,3})\s*[-~至到]\s*(\d{1,3})\s*([kK千万])?(?:·(\d{1,2})薪)?/);
  if (salaryMatch) {
    const lo = parseInt(salaryMatch[1], 10);
    const hi = parseInt(salaryMatch[2], 10);
    const unit = salaryMatch[3];
    const factor = unit === "万" ? 10 : unit === "千" ? 1 : 1; // K 为准；万换算成 K
    out.salaryMinK = lo * factor;
    out.salaryMaxK = hi * factor;
    out.salaryText = salaryMatch[0].trim();
  }

  // 城市：常见城市名
  const cities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "西安", "苏州", "长沙", "重庆", "天津", "合肥", "厦门", "青岛", "郑州", "远程"];
  for (const c of cities) {
    if (text.includes(c)) { out.city = c; break; }
  }

  // 福利标签
  for (const b of KNOWN_BENEFITS) {
    if (text.includes(b)) out.benefits.push(b);
  }
  if (/周末双休|双休/.test(text)) out.benefits.push("双休");
  if (/五险一金/.test(text)) out.benefits.push("五险一金");

  // 经验 / 学历要求
  const expMatch = text.match(/(\d)[-–~到]\s*(\d)?\s*年(?:工作|相关)?(经验)?|(\d)\s*年以[上内]/);
  if (expMatch) out.experienceReq = expMatch[0].trim();
  const eduMatch = text.match(/(大专|本科|硕士|研究生|博士)(?:及|以上|学历)?/);
  if (eduMatch) out.educationReq = eduMatch[0];

  // 公司与职位（常见行格式：公司名｜职位 / 招聘：XX工程师）
  const firstLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
  for (const line of firstLines) {
    const roleMatch = line.match(/(?:招聘|招|急聘)[:：]?\s*([\u4e00-\u9fffA-Za-z/＋+]{2,20}?(?:工程师|经理|专员|总监|设计师|产品经理|运营|架构师))/) ?? line.match(/([\u4e00-\u9fffA-Za-z]{2,12}(?:工程师|产品经理|经理|专员|设计师|架构师|运营))/);
    if (roleMatch && !out.role) { out.role = roleMatch[1]; break; }
  }

  return out;
}
