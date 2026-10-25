import { describe, expect, it } from "vitest";
import { matchJob, filterJobs, extractJdKeywords, gradeOf } from "../src/features/analysis/match";
import type { JobDto } from "../src/features/jobs/schema";
import { planOptimizations, applyOptimizations } from "../src/features/analysis/optimize";
import { parseResumeText } from "../src/features/resumes/import";
import { EMPTY_RESUME, type ResumeData } from "../src/features/resumes/schema";

function resume(patch: Partial<ResumeData>): ResumeData {
  return { ...EMPTY_RESUME, ...patch, basics: { ...EMPTY_RESUME.basics, ...patch.basics } };
}

const JOB: JobDto = {
  id: "j1", channel: "BOSS直聘", company: "X 公司", role: "后端工程师", city: "上海", salaryText: "25-40K", salaryMinK: 25, salaryMaxK: 40,
  benefits: ["五险一金", "双休"], experienceReq: "3年", educationReq: "本科",
  jdText: "岗位职责：负责 Kubernetes 云原生平台建设，主导 Go 微服务架构设计，参与 Prometheus 监控体系落地。任职要求：3年以上后端经验，精通 Go 与 Kubernetes。福利：五险一金、双休、弹性工作。",
  source: "sample", createdAt: "2026-01-01",
};

describe("职位匹配引擎", () => {
  it("强相关简历得高分并评为 S/A", () => {
    const r = resume({
      basics: { ...EMPTY_RESUME.basics, name: "A", location: "上海" },
      skills: [{ name: "Go", level: 5 }, { name: "Kubernetes", level: 4 }, { name: "Prometheus", level: 4 }],
      experience: [{ company: "Y", role: "后端", start: "2020", end: "", bullets: "主导 Kubernetes 平台建设\n精通 Go 微服务开发\n落地 Prometheus 监控体系" }],
    });
    const m = matchJob(r, JOB);
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(["S", "A"]).toContain(m.grade);
    expect(m.cityMatch).toBe("same");
  });

  it("空简历得低分评为 C，且缺失关键词进入指导", () => {
    const m = matchJob(EMPTY_RESUME, JOB);
    expect(m.grade).toBe("C");
    expect(m.guidance.some((g) => g.includes("Kubernetes") || g.includes("Go"))).toBe(true);
  });

  it("城市不匹配给出地点提醒", () => {
    const r = resume({ basics: { ...EMPTY_RESUME.basics, name: "B", location: "成都" } });
    const m = matchJob(r, JOB);
    expect(m.cityMatch).toBe("diff");
    expect(m.guidance.some((g) => g.includes("地点"))).toBe(true);
  });

  it("筛选器：城市/双休/远程/薪资", () => {
    const jobs: JobDto[] = [
      { ...JOB, id: "1", city: "上海", benefits: ["双休", "五险一金"], salaryMaxK: 40 },
      { ...JOB, id: "2", city: "北京", benefits: ["大小周"], salaryMaxK: 50 },
      { ...JOB, id: "3", city: "远程", benefits: ["远程办公"], salaryMaxK: 30 },
    ];
    expect(filterJobs(jobs, { city: "上海" }).map((j) => j.id)).toEqual(["1"]);
    expect(filterJobs(jobs, { weekendOnly: true }).map((j) => j.id)).toEqual(["1"]);
    expect(filterJobs(jobs, { remoteOnly: true }).map((j) => j.id)).toEqual(["3"]);
    expect(filterJobs(jobs, { salaryMinK: 45 }).map((j) => j.id)).toEqual(["2"]);
    expect(filterJobs(jobs, { benefits: ["双休", "五险一金"] }).map((j) => j.id)).toEqual(["1"]);
  });

  it("JD 分词：不产生英文碎片，保留原始大小写", () => {
    const kws = extractJdKeywords("负责 Kubernetes 与 Terraform 基础设施建设");
    expect(kws).toContain("Kubernetes");
    expect(kws).toContain("Terraform");
    expect(kws.some((k) => k === "Ku" || k === "Kub")).toBe(false);
  });

  it("分级阈值", () => {
    expect(gradeOf(90).grade).toBe("S");
    expect(gradeOf(75).grade).toBe("A");
    expect(gradeOf(60).grade).toBe("B");
    expect(gradeOf(30).grade).toBe("C");
  });
});

describe("一键优化", () => {
  it("弱动词开头升级（了解→熟悉，熟悉保持不变）", () => {
    const r = resume({ experience: [{ company: "A", role: "", start: "", end: "", bullets: "了解 Go 与 K8s\n熟悉 PostgreSQL" }] });
    const ops = planOptimizations(r);
    const weak = ops.filter((o) => o.kind === "weak-verb");
    expect(weak.length).toBe(1);
    const applied = applyOptimizations(r, ops, ops.map((o) => o.id));
    expect(applied.experience[0].bullets).toContain("熟悉 Go 与 K8s");
    expect(applied.experience[0].bullets).toContain("熟悉 PostgreSQL");
  });

  it("重复条目去重", () => {
    const r = resume({ experience: [{ company: "A", role: "", start: "", end: "", bullets: "主导重构项目\n主导重构项目\n搭建监控体系" }] });
    const ops = planOptimizations(r);
    expect(ops.some((o) => o.kind === "dedupe")).toBe(true);
    const applied = applyOptimizations(r, ops, ops.map((o) => o.id));
    expect(applied.experience[0].bullets.split("\n")).toHaveLength(2);
  });

  it("总结草稿：仅基于已有事实拼装", () => {
    const r = resume({
      experience: [{ company: "A", role: "后端工程师", start: "2020", end: "", bullets: "完成模块开发" }],
      skills: [{ name: "Go", level: 5 }, { name: "K8s", level: 4 }],
    });
    const ops = planOptimizations(r);
    const draft = ops.find((o) => o.kind === "summary-draft");
    expect(draft).toBeTruthy();
    const applied = applyOptimizations(r, ops, ["summary-draft"]);
    expect(applied.basics.summary).toContain("后端工程师");
    expect(applied.basics.summary).toContain("Go");
  });

  it("应用顺序：未选中的变换不生效", () => {
    const r = resume({ experience: [{ company: "A", role: "", start: "", end: "", bullets: "熟悉 Go\n主导重构" }] });
    const ops = planOptimizations(r);
    const applied = applyOptimizations(r, ops, []); // 全不选
    expect(applied.experience[0].bullets).toBe("熟悉 Go\n主导重构");
  });
});

describe("简历文本导入", () => {
  const sample = `林然
求职意向：高级产品经理
邮箱：linran@example.com
手机：13900139000

工作经历
云枢科技 高级产品经理 2021.03 - 至今
主导数据平台定价模块重构，年增收 1200 万
搭建自助分析看板，客户配置耗时降低 90%

教育经历
浙江大学 本科 2014-2018 信息管理与信息系统

专业技能
产品规划（精通）、SQL（熟悉）、Axure（精通）`;

  it("解析联系方式与姓名", () => {
    const r = parseResumeText(sample);
    expect(r.data.basics.name).toBe("林然");
    expect(r.data.basics.email).toBe("linran@example.com");
    expect(r.data.basics.phone).toBe("13900139000");
    expect(r.data.basics.headline).toContain("产品经理");
  });

  it("按日期区间拆分工作经历", () => {
    const r = parseResumeText(sample);
    expect(r.data.experience.length).toBeGreaterThanOrEqual(1);
    expect(r.data.experience[0].company).toContain("云枢科技");
    expect(r.data.experience[0].bullets).toContain("年增收 1200 万");
  });

  it("技能括号熟练度映射", () => {
    const r = parseResumeText(sample);
    const pm = r.data.skills.find((s) => s.name.includes("产品规划"));
    expect(pm?.level).toBe(5);
    const sql = r.data.skills.find((s) => s.name.includes("SQL"));
    expect(sql?.level).toBe(3);
  });

  it("教育经历识别学校与学历", () => {
    const r = parseResumeText(sample);
    expect(r.data.education[0].school).toBe("浙江大学");
    expect(r.data.education[0].degree).toBe("本科");
  });

  it("空文本给警告不抛错", () => {
    const r = parseResumeText("");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

import { normalizeTencent, normalizeV2ex, normalizeEleduck } from "../src/features/jobs/external";

describe("真实数据源归一化", () => {
  it("腾讯官网：城市/事业部/JD/经验映射", () => {
    const out = normalizeTencent([
      { RecruitPostName: "游戏AI-强化学习算法研究员", LocationName: "深圳", CategoryName: "技术", BGName: "IEG", Responsibility: "参与腾讯游戏AI算法研究</p>强化学习、模仿学习", RequireWorkYearsName: "3年以上", PostURL: "https://careers.tencent.com/jobdesc.html?postId=1" },
    ]);
    expect(out[0].city).toBe("深圳");
    expect(out[0].company).toContain("腾讯");
    expect(out[0].origin).toBe("腾讯官网");
    expect(out[0].jdText).toContain("强化学习");
    expect(out[0].url).toContain("postId=1");
  });

  it("V2EX：标题前缀剥离 + 城市识别 + 薪资提取", () => {
    const out = normalizeV2ex([
      { id: 1, title: "[北京] 招聘后端工程师 Go 25k-40k", content: "负责高并发服务开发，远程友好", url: "https://v2ex.com/t/1" },
    ]);
    expect(out[0].city).toBe("北京");
    expect(out[0].role).not.toContain("[");
    expect(out[0].salaryText).toBe("25k-40k");
    expect(out[0].origin).toBe("V2EX酷工作");
  });

  it("电鸭：远程默认城市 + 发布链接", () => {
    const out = normalizeEleduck([{ id: "abc", title: "全栈工程师｜某远程团队", summary: "React + Node.js 远程协作" }]);
    expect(out[0].city).toBe("远程");
    expect(out[0].benefits).toContain("远程办公");
    expect(out[0].url).toBe("https://eleduck.com/posts/abc");
    expect(out[0].origin).toBe("电鸭社区");
  });
});

describe("技能栈护栏", () => {
  it("技能零重叠的跨职能匹配被封顶 B 级并给出建议", () => {
    const pm = resume({
      basics: { ...EMPTY_RESUME.basics, name: "产品", location: "上海", summary: "负责后台服务开发，协同 Go 与 MySQL 团队，熟悉分布式系统与 Kubernetes 的产品节奏，参与平台架构设计" },
      skills: [{ name: "产品规划", level: 5 }, { name: "Axure", level: 5 }, { name: "用户研究", level: 4 }],
      experience: [{ company: "X", role: "产品经理", start: "2020", end: "", bullets: "6年经验，负责后台服务开发与平台架构设计评审" }],
    });
    const backendJd: JobDto = { ...JOB, id: "be", jdText: "负责后台服务开发，精通 Go，熟悉分布式系统与 Kubernetes，参与平台架构设计，3年以上经验" };
    const m = matchJob(pm, backendJd);
    expect(m.score).toBeLessThanOrEqual(69);
    expect(m.grade).toBe("B");
    expect(m.guidance.some((g) => g.includes("技能错配"))).toBe(true);
  });

  it("技能有重叠的匹配不受封顶影响", () => {
    const dev = resume({
      basics: { ...EMPTY_RESUME.basics, name: "开发", location: "上海" },
      skills: [{ name: "Go", level: 5 }, { name: "Kubernetes", level: 4 }, { name: "MySQL", level: 4 }],
      experience: [{ company: "Y", role: "后端", start: "2020", end: "", bullets: "7年后端开发经验，精通 Go 与 MySQL 后台服务开发，负责 Kubernetes 平台架构设计与分布式系统建设" }],
    });
    const m = matchJob(dev, { ...JOB, jdText: "负责后台服务开发，精通 Go 与 MySQL，熟悉分布式系统与 Kubernetes，参与平台架构设计，3年以上经验", experienceReq: "3年" });
    expect(m.grade === "S" || m.grade === "A").toBe(true);
  });
});
