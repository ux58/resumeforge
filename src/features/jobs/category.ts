/**
 * 岗位类别分类器：从职位名/技能标签推断职能类别（对自建职位库与外部真实数据统一生效）。
 * 顺序敏感：具体的在前（游戏/算法），泛化的在后（后端/产品）。
 */

export const JOB_CATEGORIES = [
  "后端开发", "前端开发", "移动开发", "全栈", "算法/AI", "数据", "测试",
  "运维/DevOps", "安全", "架构", "游戏开发", "硬件/嵌入式", "产品", "设计",
  "运营", "市场/销售", "人力/行政", "财务", "其他",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

const RULES: Array<{ cat: JobCategory; re: RegExp }> = [
  { cat: "算法/AI", re: /算法|机器学习|深度学习|LLM|NLP|大模型|AIGC|Machine Learning|AI Research|Computer Vision|智能/ },
  { cat: "游戏开发", re: /游戏|Unity|Unreal|Gameloft|关卡|美术设计/ },
  { cat: "数据", re: /数据分析|数据开发|数据仓库|数据产品|BI|数仓|ETL|Data Analyst|Data Engineer|Data Sci/ },
  { cat: "前端开发", re: /前端|Web开发|React|Vue|H5|Frontend|Front-end|Web Engineer/ },
  { cat: "移动开发", re: /Android|iOS|移动端|Flutter|移动开发|Mobile/ },
  { cat: "测试", re: /测试|QA|质量保障|Test|自动化测试/ },
  { cat: "运维/DevOps", re: /运维|SRE|DevOps|基础设施|系统管理|Site Reliability|Ops/ },
  { cat: "安全", re: /安全|信息安全|渗透|Security|风控/ },
  { cat: "架构", re: /架构师|Architect/ },
  { cat: "硬件/嵌入式", re: /硬件|嵌入式|芯片|单片机|Firmware|Embedded|IC设计/ },
  { cat: "后端开发", re: /后端|服务端|后台开发|Java|Golang|\bGo\b|Python|PHP|C\+\+|Rust|Node\.?js|Backend|Server|服务开发/ },
  { cat: "全栈", re: /全栈|Full.?stack/ },
  { cat: "产品", re: /产品经理|产品总监|产品策划|Product Manager|Product Owner|产品/ },
  { cat: "设计", re: /设计师|设计|UI|UX|视觉|交互|Designer/ },
  { cat: "运营", re: /运营|增长|内容|编辑|社群|Community|Growth|Operations/ },
  { cat: "市场/销售", re: /市场|营销|销售|BD|商务|渠道|Marketing|Sales/ },
  { cat: "人力/行政", re: /人力|HR|招聘|行政|人事/ },
  { cat: "财务", re: /财务|会计|审计|Finance|Accounting/ },
];

/** 推断岗位类别：优先职位名，其次技能/JD 文本 */
export function classifyJobCategory(role: string, extra = ""): JobCategory {
  const text = (role + " " + extra).trim();
  if (!text) return "其他";
  for (const { cat, re } of RULES) {
    if (re.test(role)) return cat;
  }
  for (const { cat, re } of RULES) {
    if (re.test(text)) return cat;
  }
  return "其他";
}
