import { describe, expect, it } from "vitest";
import { analyzeResume } from "../src/features/analysis/engine";
import { EMPTY_RESUME, resumeDataSchema, type ResumeData } from "../src/features/resumes/schema";

function buildResume(patch: Partial<ResumeData>): ResumeData {
  return { ...EMPTY_RESUME, ...patch, basics: { ...EMPTY_RESUME.basics, ...patch.basics } };
}

describe("简历优化引擎", () => {
  it("空简历：低分且给出高优先级建议", () => {
    const r = analyzeResume(EMPTY_RESUME);
    expect(r.total).toBeLessThan(30);
    expect(r.suggestions.some((s) => s.severity === "high")).toBe(true);
    expect(r.suggestions.some((s) => s.target === "experience")).toBe(true);
  });

  it("联系方式校验：非法邮箱触发 high 建议", () => {
    const r = analyzeResume(buildResume({ basics: { ...EMPTY_RESUME.basics, name: "张三", email: "not-an-email" } }));
    expect(r.suggestions.some((s) => s.target === "basics" && s.severity === "high" && s.message.includes("邮箱"))).toBe(true);
  });

  it("量化成果：带数字的条目提升量化维度", () => {
    const base = { company: "A 公司", role: "后端", start: "2021", end: "2023" };
    const weak = analyzeResume(buildResume({ experience: [{ ...base, bullets: "负责相关工作，参与日常维护" }] }));
    const strong = analyzeResume(buildResume({ experience: [{ ...base, bullets: "主导网关重构，接口 P99 降低 85%，服务 30 万用户" }] }));
    const qWeak = weak.dimensions.find((d) => d.key === "quantify")!.score;
    const qStrong = strong.dimensions.find((d) => d.key === "quantify")!.score;
    expect(qStrong).toBeGreaterThan(qWeak);
    expect(strong.suggestions.some((s) => s.message.includes("弱动词"))).toBe(false);
  });

  it("JD 关键词：缺失关键词给出补齐建议并计入维度", () => {
    const jd = "岗位职责：负责 Kubernetes 集群运维与 Terraform 基础设施即代码建设，要求熟悉 Prometheus 监控体系";
    const r = analyzeResume(buildResume({ targetJob: jd, experience: [{ company: "B", role: "SRE", start: "2020", end: "", bullets: "搭建 Kubernetes 集群与 Prometheus 监控，保障 10 万核规模稳定运行" }] }));
    expect(r.keywords.missing).toContain("Terraform");
    expect(r.keywords.matched.length).toBeGreaterThan(0);
    const kw = r.dimensions.find((d) => d.key === "keywords")!.score;
    expect(kw).toBeGreaterThan(0);
  });

  it("完整简历总分显著高于空简历", () => {
    const full = analyzeResume(
      buildResume({
        basics: { name: "李四", headline: "高级前端工程师", email: "lisi@example.com", phone: "13800138000", location: "上海", website: "", summary: "6 年前端架构经验，主导过多个百万级 DAU 项目的性能优化与工程化建设。" },
        experience: [{ company: "某科技", role: "高级前端", start: "2020", end: "", bullets: "主导核心链路重构，首屏耗时降低 60%\n搭建组件库，覆盖 30+ 业务线\n带队 5 人完成微前端落地，发布效率提升 3 倍" }],
        education: [{ school: "某大学", degree: "本科", field: "计算机", start: "2013", end: "2017", desc: "" }],
        skills: [{ name: "React", level: 5 }, { name: "TypeScript", level: 5 }, { name: "工程化", level: 4 }, { name: "Node.js", level: 4 }],
        projects: [{ name: "性能专项", role: "负责人", link: "", tech: "React", desc: "通过代码分割与缓存策略，LCP 从 4.2s 降至 1.6s" }],
      }),
    );
    expect(full.total).toBeGreaterThan(70);
    expect(full.suggestions.length).toBeLessThan(5);
  });

  it("统计与去重：相同建议不重复出现", () => {
    const r = analyzeResume(EMPTY_RESUME);
    const keys = r.suggestions.map((s) => s.target + s.message.slice(0, 20));
    expect(new Set(keys).size).toBe(keys.length);
    expect(r.stats.bullets).toBe(0);
  });
});

describe("简历数据 schema", () => {
  it("空对象可解析出全默认结构", () => {
    const parsed = resumeDataSchema.parse({});
    expect(parsed.basics.name).toBe("");
    expect(parsed.skills).toEqual([]);
  });

  it("技能等级越界被拒绝", () => {
    expect(() => resumeDataSchema.parse({ skills: [{ name: "x", level: 6 }] })).toThrow();
    expect(() => resumeDataSchema.parse({ skills: [{ name: "x", level: 0 }] })).toThrow();
  });

  it("数组长度上限防滥用", () => {
    const many = Array.from({ length: 41 }, () => ({ name: "s", level: 3 }));
    expect(() => resumeDataSchema.parse({ skills: many })).toThrow();
  });
});
