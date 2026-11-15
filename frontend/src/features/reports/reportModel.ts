import type { FinalReport, ReportTaskResult, RunSnapshot, TaskResult } from "../../api/types";

export const DIMENSIONS: Record<string, string> = { fundamental: "基本面", market: "市场", news: "新闻", analyst: "分析师" };
export const RATINGS: Record<string, string> = { buy: "买入", hold: "持有", sell: "卖出" };

export interface ReportEntry {
  runId: string;
  taskId: string;
  question: string;
  status: TaskResult["status"];
  report: FinalReport | null;
  errors: { constraint?: string; message?: string }[];
  draft: boolean;
  createdAt: string;
}

export function parseReport(raw: unknown): FinalReport | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as FinalReport;
  } catch {
    return null;
  }
}

/** Every report task in a run, readable or not; drafts are partial/invalid ones. */
export function reportEntries(snapshot: RunSnapshot): ReportEntry[] {
  const tasks = snapshot.state.plan?.tasks?.filter((t) => t.category === "report") ?? [];
  return tasks.map((task) => {
    const record = snapshot.state.task_results?.[task.task_id];
    const result = (record?.result ?? null) as ReportTaskResult | null;
    const report = result ? parseReport(result.final_report) : null;
    const errors = result?.validation_errors ?? [];
    return {
      runId: snapshot.run_id,
      taskId: task.task_id,
      question: task.question,
      status: record?.status ?? "failed",
      report,
      errors,
      draft: record?.status !== "completed" || errors.length > 0,
      createdAt: snapshot.finished_at ?? snapshot.created_at,
    };
  });
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text) : [];
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && !/[\s<>"]/.test(value)) return value;
  } catch {
    /* not a URL */
  }
  return null;
}

/** Markdown export matching backend app/report_viewer.report_markdown in structure. */
export function reportMarkdown(entry: ReportEntry): string {
  const r = entry.report!;
  const lines = [`# ${text(r.research_topic) || "投研报告"}`, ""];
  if (entry.draft) lines.push("> 草稿：报告未完全通过校验或任务仅部分完成。", "");
  lines.push(
    `- 行业焦点：${text(r.industry_focus)}`,
    `- 研究期限：${text(r.time_horizon)}`,
    `- 报告日期：${text(r.report_date)}`,
    `- 模型评级：${RATINGS[text(r.overall_rating)] ?? text(r.overall_rating)}（模型分析结论，不是交易建议）`,
    "",
    "## 投资论点",
    "",
    text(r.investment_thesis),
    "",
    "## 四维度分析",
    "",
  );
  for (const [key, label] of Object.entries(DIMENSIONS)) {
    const dim = r.dimensions?.[key];
    if (!dim) continue;
    lines.push(`### ${label}`, "", text(dim.summary), "", `分析置信度：${Math.round(Number(dim.confidence) * 100)}%（指模型对分析的信心，不是收益概率）`, "");
  }
  lines.push("## 支撑证据", "", ...list(r.supporting_evidence).map((e) => `- ${e}`), "", "## 风险因素", "", ...list(r.risk_factors).map((e) => `- ${e}`), "", "## 来源", "");
  for (const source of list(r.sources)) {
    const url = safeUrl(source);
    lines.push(url ? `- <${url}>` : `- ${source}`);
  }
  if (entry.errors.length) {
    lines.push("", "## 校验提示", "", ...entry.errors.map((e) => `- ${e.constraint ?? ""} ${e.message ?? ""}`.trim()));
  }
  return lines.join("\n");
}

export function downloadText(filename: string, content: string, type = "text/markdown;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
