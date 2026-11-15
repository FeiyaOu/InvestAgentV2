import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../../api/runView";
import type { FinalReport } from "../../api/types";
import { reportEntries, reportMarkdown } from "./reportModel";

const REPORT: FinalReport = {
  research_topic: "新能源行业",
  industry_focus: "光伏",
  time_horizon: "中期",
  report_date: "2026-11-15",
  dimensions: {
    fundamental: { summary: "基本面分析", confidence: 0.85 },
    market: { summary: "市场分析", confidence: 0.78 },
    news: { summary: "新闻分析", confidence: 0.72 },
    analyst: { summary: "分析师观点", confidence: 0.8 },
  },
  investment_thesis: "核心投资逻辑",
  supporting_evidence: ["证据1"],
  overall_rating: "buy",
  risk_factors: ["风险1 *含星号*"],
  sources: ["https://example.com/a", "javascript:alert(1)", "口头来源"],
};

function snapshotWith(result: Record<string, unknown> | null, status = "completed") {
  const s = emptySnapshot("run1", "c", "生成报告");
  s.state = {
    plan: { status: "ready", clarification_questions: [], tasks: [{ task_id: "rep", category: "report", question: "生成报告", depends_on: [] }] },
    task_results: result
      ? { rep: { task_id: "rep", category: "report", question: "生成报告", depends_on: [], status: status as "completed", result, error: null } }
      : {},
  };
  return s;
}

describe("reportEntries", () => {
  it("parses string or object final_report and flags drafts", () => {
    const [done] = reportEntries(snapshotWith({ final_report: JSON.stringify(REPORT), validation_errors: [] }));
    expect(done.report?.research_topic).toBe("新能源行业");
    expect(done.draft).toBe(false);
    const [draft] = reportEntries(snapshotWith({ final_report: REPORT, validation_errors: [{ constraint: "C5", message: "来源不足" }] }, "partial"));
    expect(draft.draft).toBe(true);
    expect(draft.errors).toHaveLength(1);
    const [pending] = reportEntries(snapshotWith(null));
    expect(pending.report).toBeNull();
    const [garbage] = reportEntries(snapshotWith({ final_report: "{not json" }));
    expect(garbage.report).toBeNull();
  });
});

describe("reportMarkdown", () => {
  it("exports all sections, marks drafts and only links http(s) sources", () => {
    const [entry] = reportEntries(snapshotWith({ final_report: REPORT, validation_errors: [{ constraint: "C5", message: "来源不足" }] }, "partial"));
    const md = reportMarkdown(entry);
    expect(md).toContain("# 新能源行业");
    expect(md).toContain("> 草稿");
    expect(md).toContain("模型评级：买入（模型分析结论，不是交易建议）");
    expect(md).toContain("### 基本面");
    expect(md).toContain("分析置信度：85%");
    expect(md).toContain("- <https://example.com/a>");
    expect(md).toContain("- javascript:alert(1)");
    expect(md).not.toContain("<javascript:");
    expect(md).toContain("## 校验提示");
    expect(md).toContain("C5 来源不足");
  });
});
