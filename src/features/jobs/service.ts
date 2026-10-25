import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import type { JobCreateInput, JobDto } from "./schema";

/** 示例职位库：22 个国内典型岗位，覆盖主流渠道与城市；随版本升级自动同步到用户职位库 */
const SAMPLES: JobCreateInput[] = [
  { company: "字节跳动", role: "后端开发工程师（支付方向）", city: "北京", salaryText: "30-50K·15薪", salaryMinK: 30, salaryMaxK: 50, benefits: ["五险一金", "免费班车", "股票期权", "弹性工作", "餐补", "年终奖"], experienceReq: "3-5年", educationReq: "本科", channel: "BOSS直聘", jdText: "负责支付与清结算核心系统的架构设计与开发，参与高并发资金链路建设。精通 Go 或 Java，熟悉分布式事务与消息队列。", source: "sample" },
  { company: "阿里云", role: "云原生研发工程师", city: "杭州", salaryText: "28-45K·16薪", salaryMinK: 28, salaryMaxK: 45, benefits: ["六险一金", "股票期权", "年终奖", "定期体检", "带薪年假"], experienceReq: "3年以上", educationReq: "本科", channel: "官网", jdText: "负责容器服务与 Serverless 产品研发，参与 Kubernetes 生态建设。精通 Go，深入理解 Kubernetes 调度与网络模型，熟悉 Prometheus 可观测性体系。", source: "sample" },
  { company: "腾讯", role: "前端开发工程师（高级）", city: "深圳", salaryText: "25-40K·16薪", salaryMinK: 25, salaryMaxK: 40, benefits: ["五险一金", "弹性工作", "免费班车", "餐补", "年终奖", "带薪年假"], experienceReq: "3-5年", educationReq: "本科", channel: "猎聘", jdText: "负责大型 ToC 产品前端架构与性能优化，建设跨端研发体系。精通 React/TypeScript，有微前端与工程化实践经验。", source: "sample" },
  { company: "美团", role: "数据产品经理", city: "北京", salaryText: "25-40K·15.5薪", salaryMinK: 25, salaryMaxK: 40, benefits: ["五险一金", "弹性工作", "免费班车", "餐补", "年终奖"], experienceReq: "3-5年", educationReq: "本科", channel: "BOSS直聘", jdText: "负责 B 端数据产品规划与迭代，搭建经营分析看板与指标体系。3-5年 B 端产品经验，熟练 SQL 与数据可视化。", source: "sample" },
  { company: "远程优先科技公司", role: "全栈工程师（远程）", city: "远程", salaryText: "20-35K", salaryMinK: 20, salaryMaxK: 35, benefits: ["远程办公", "弹性工作", "六险一金", "带薪年假"], experienceReq: "3年以上", educationReq: "不限", channel: "其他", jdText: "参与 SaaS 产品全栈开发（Next.js + Node.js + Postgres），异步协作结果导向。3年以上全栈经验，熟悉 React 与 Node.js，英语读写流畅。", source: "sample" },
  { company: "小红书", role: "社区产品经理（增长方向）", city: "上海", salaryText: "22-38K·14薪", salaryMinK: 22, salaryMaxK: 38, benefits: ["五险一金", "弹性工作", "餐补", "年终奖", "定期体检"], experienceReq: "1-3年", educationReq: "本科", channel: "拉勾", jdText: "负责社区增长玩法设计与数据分析闭环。1-3年增长产品经验，数据敏感，熟悉 A/B 实验体系。", source: "sample" },
  { company: "网易有道", role: "AI 应用工程师", city: "杭州", salaryText: "25-45K·14薪", salaryMinK: 25, salaryMaxK: 45, benefits: ["五险一金", "弹性工作", "年终奖", "定期体检", "住房补贴"], experienceReq: "2年以上", educationReq: "本科", channel: "智联招聘", jdText: "基于 LLM 构建教育场景智能应用（RAG/Agent）。2年以上后端经验，熟悉 Python 或 Go，了解 Prompt 工程与向量检索。", source: "sample" },
  { company: "某跨境电商独角兽", role: "Java 高级开发", city: "深圳", salaryText: "22-35K·14薪", salaryMinK: 22, salaryMaxK: 35, benefits: ["五险一金", "大小周", "年终奖", "交通补贴"], experienceReq: "3-5年", educationReq: "大专", channel: "前程无忧", jdText: "负责订单中台与履约系统开发。Java 基础扎实，熟悉 Spring Cloud 与 MySQL 调优。", source: "sample" },
  { company: "拼多多", role: "服务端开发工程师", city: "上海", salaryText: "35-60K·16薪", salaryMinK: 35, salaryMaxK: 60, benefits: ["五险一金", "加班补贴", "年终奖", "餐补"], experienceReq: "3-5年", educationReq: "本科", channel: "BOSS直聘", jdText: "负责电商交易链路服务端研发，保障大促高并发场景稳定性。精通 Java 或 Go，熟悉高并发、分布式缓存与消息队列。", source: "sample" },
  { company: "百度", role: "前端研发工程师", city: "北京", salaryText: "25-40K·14.5薪", salaryMinK: 25, salaryMaxK: 40, benefits: ["五险一金", "免费班车", "弹性工作", "年终奖", "定期体检"], experienceReq: "3年以上", educationReq: "本科", channel: "猎聘", jdText: "负责搜索与智能云前端技术体系建设，推进组件化与性能优化。精通 React 或 Vue，熟悉构建工具链与微前端。", source: "sample" },
  { company: "华为", role: "云计算软件工程师", city: "深圳", salaryText: "28-45K·14薪", salaryMinK: 28, salaryMaxK: 45, benefits: ["五险一金", "住房补贴", "年终奖", "定期体检", "带薪年假"], experienceReq: "3年以上", educationReq: "硕士", channel: "官网", jdText: "负责云服务控制面与调度系统开发。精通 Go/Java，熟悉分布式系统设计，有云平台研发经验优先；硕士及以上学历。", source: "sample" },
  { company: "携程", role: "高级测试开发工程师", city: "上海", salaryText: "22-35K·13薪", salaryMinK: 22, salaryMaxK: 35, benefits: ["五险一金", "双休", "弹性工作", "带薪年假"], experienceReq: "3-5年", educationReq: "本科", channel: "智联招聘", jdText: "建设自动化测试平台与质量度量体系。熟悉 Python/Java，有 Selenium 或流量回放经验，双休不加班。", source: "sample" },
  { company: "快手", role: "高级产品经理（直播）", city: "北京", salaryText: "30-50K·15薪", salaryMinK: 30, salaryMaxK: 50, benefits: ["五险一金", "免费班车", "餐补", "年终奖", "股票期权"], experienceReq: "5年以上", educationReq: "本科", channel: "猎聘", jdText: "负责直播生态产品策略与商业化增长。5年以上直播/社区产品经验，数据驱动，有大型活动操盘案例。", source: "sample" },
  { company: "米哈游", role: "游戏客户端开发（Unity）", city: "上海", salaryText: "25-45K·14薪", salaryMinK: 25, salaryMaxK: 45, benefits: ["六险一金", "弹性工作", "餐补", "年终奖", "带薪年假"], experienceReq: "3年以上", educationReq: "本科", channel: "BOSS直聘", jdText: "负责开放世界玩法系统与工具链开发。精通 C# 与 Unity，熟悉性能优化与资源管理，热爱游戏。", source: "sample" },
  { company: "理想汽车", role: "智能驾驶产品经理", city: "北京", salaryText: "30-45K·14薪", salaryMinK: 30, salaryMaxK: 45, benefits: ["五险一金", "免费班车", "餐补", "年终奖"], experienceReq: "3-5年", educationReq: "本科", channel: "脉脉", jdText: "负责智驾功能的产品规划与用户体验设计。3-5年汽车/智能硬件产品经验，熟悉整车研发流程。", source: "sample" },
  { company: "京东", role: "供应链算法工程师", city: "北京", salaryText: "28-45K·15薪", salaryMinK: 28, salaryMaxK: 45, benefits: ["五险一金", "免费班车", "年终奖", "餐补"], experienceReq: "3年以上", educationReq: "硕士", channel: "官网", jdText: "负责仓配网络优化与库存预测算法研发。精通 Python，熟悉运筹优化或机器学习，有供应链场景经验优先。", source: "sample" },
  { company: "网易", role: "游戏运营专员", city: "杭州", salaryText: "15-25K·14薪", salaryMinK: 15, salaryMaxK: 25, benefits: ["五险一金", "餐补", "年终奖", "弹性工作"], experienceReq: "1-3年", educationReq: "本科", channel: "拉勾", jdText: "负责游戏活动策划与玩家社区运营。1-3年游戏运营经验，数据敏感，热爱游戏行业。", source: "sample" },
  { company: "商汤科技", role: "计算机视觉研究员", city: "上海", salaryText: "30-55K·15薪", salaryMinK: 30, salaryMaxK: 55, benefits: ["五险一金", "股票期权", "年终奖", "定期体检"], experienceReq: "3年以上", educationReq: "硕士", channel: "内推", jdText: "负责视觉感知算法研发与落地。精通 PyTorch，有检测/分割方向论文或竞赛经历，硕士及以上学历。", source: "sample" },
  { company: "蔚来", role: "充换电网络规划经理", city: "合肥", salaryText: "20-35K·14薪", salaryMinK: 20, salaryMaxK: 35, benefits: ["五险一金", "加班补贴", "年终奖", "交通补贴"], experienceReq: "3-5年", educationReq: "本科", channel: "前程无忧", jdText: "负责充换电站网络布局规划与选址模型建设。3-5年新能源或地产行业经验，熟悉 GIS 工具优先。", source: "sample" },
  { company: "欢聚集团", role: "Java 开发工程师", city: "广州", salaryText: "20-35K·14薪", salaryMinK: 20, salaryMaxK: 35, benefits: ["五险一金", "年终奖", "餐补", "定期体检"], experienceReq: "3年以上", educationReq: "本科", channel: "BOSS直聘", jdText: "负责直播社交后端服务开发。Java 基础扎实，熟悉 Redis、Kafka 与分布式服务治理。", source: "sample" },
  { company: "中科大讯飞", role: "教育产品总监", city: "合肥", salaryText: "35-55K·16薪", salaryMinK: 35, salaryMaxK: 55, benefits: ["五险一金", "住房补贴", "年终奖", "股票期权"], experienceReq: "5年以上", educationReq: "硕士", channel: "猎聘", jdText: "负责智慧教育产品线战略规划与团队管理。5年以上教育科技产品经验，3年以上团队管理经验。", source: "sample" },
  { company: "数字马力", role: "全栈开发工程师（远程）", city: "远程", salaryText: "18-32K", salaryMinK: 18, salaryMaxK: 32, benefits: ["远程办公", "弹性工作", "六险一金", "带薪年假"], experienceReq: "2年以上", educationReq: "不限", channel: "其他", jdText: "参与企业数字化项目全栈交付（Vue + Spring Boot）。2年以上全栈经验，自驱力强，适应远程协作。", source: "sample" },
];

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

/** 示例职位同步：按公司+职位键匹配，缺失插入、已存在更新（渠道/JD/福利随版本升级），手动添加的职位不受影响 */
export async function ensureSampleJobs(userId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.jobs.id, company: schema.jobs.company, role: schema.jobs.role, source: schema.jobs.source })
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId));
  const sampleKey = (c: string, r: string) => c + "|" + r;
  const manual = rows.filter((r) => r.source !== "sample");
  if (rows.length && manual.length === 0 && rows.length >= SAMPLES.length) return; // 已是最新样本库
  const existingKeys = new Set(rows.map((r) => sampleKey(r.company, r.role)));
  for (const sample of SAMPLES) {
    const key = sampleKey(sample.company, sample.role);
    if (existingKeys.has(key)) {
      await db
        .update(schema.jobs)
        .set({
          city: sample.city,
          salaryText: sample.salaryText,
          salaryMinK: sample.salaryMinK ?? null,
          salaryMaxK: sample.salaryMaxK ?? null,
          benefits: sample.benefits,
          experienceReq: sample.experienceReq,
          educationReq: sample.educationReq,
          jdText: sample.jdText,
          channel: sample.channel,
        })
        .where(and(eq(schema.jobs.userId, userId), eq(schema.jobs.company, sample.company), eq(schema.jobs.role, sample.role)));
    } else {
      await db.insert(schema.jobs).values({
        userId,
        company: sample.company,
        role: sample.role,
        city: sample.city,
        salaryText: sample.salaryText,
        salaryMinK: sample.salaryMinK ?? null,
        salaryMaxK: sample.salaryMaxK ?? null,
        benefits: sample.benefits,
        experienceReq: sample.experienceReq,
        educationReq: sample.educationReq,
        jdText: sample.jdText,
        channel: sample.channel,
        source: sample.source,
      });
    }
  }
}
