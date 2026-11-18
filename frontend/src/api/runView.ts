/**
 * Client-side mirror of backend api/events.py: fold ordered events into a RunSnapshot.
 * The server ships a full snapshot on GET; live SSE events are applied on top with `applyEvent`.
 */
import type { ParentState, RunEvent, RunSnapshot, RunStatus, TaskCategory, ClarificationInterrupt } from "./types";

export const TERMINAL: RunStatus[] = ["completed", "failed", "waiting_input", "cancelled"];

export function emptySnapshot(runId: string, conversationId: string, query: string): RunSnapshot {
  return {
    run_id: runId,
    conversation_id: conversationId,
    query,
    status: "queued",
    created_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    error: null,
    elapsed_seconds: null,
    event_count: 0,
    state: {},
    report_progress: {},
    analysis_snapshots: {},
    strategy_series: {},
    planner_attempts: [],
    active_task: null,
    active_category: null,
    interrupt: null,
  };
}

export function applyEvent(snapshot: RunSnapshot, event: RunEvent): RunSnapshot {
  if (event.seq <= snapshot.event_count) return snapshot;
  const next: RunSnapshot = { ...snapshot, event_count: event.seq };
  const p = event.payload as Record<string, any>;
  switch (event.type) {
    case "run_cancelling":
      next.status = "cancelling";
      break;
    case "run_started":
      next.status = "running";
      next.started_at = next.started_at ?? event.at;
      break;
    case "run_waiting":
      next.status = "waiting_input";
      next.elapsed_seconds = p.elapsed_seconds ?? next.elapsed_seconds;
      break;
    case "run_finished":
      next.status = p.status as RunStatus;
      next.finished_at = event.at;
      next.error = p.error ?? null;
      if (next.status === "cancelled") next.interrupt = null;
      next.elapsed_seconds = p.elapsed_seconds ?? next.elapsed_seconds;
      break;
    case "clarification_required":
      next.interrupt = p as ClarificationInterrupt;
      break;
    case "clarification_answered":
      next.interrupt = null;
      next.status = "queued";
      break;
    case "planner_attempt":
      next.planner_attempts = [...snapshot.planner_attempts, p];
      break;
    case "task_started":
      next.active_task = (p.task_id as string) ?? null;
      next.active_category = (p.category as TaskCategory) ?? null;
      break;
    case "analysis_artifacts": {
      const id = p.task_id as string;
      next.analysis_snapshots = {
        ...snapshot.analysis_snapshots,
        [id]: { ...(snapshot.analysis_snapshots[id] ?? {}), ...(p.artifacts ?? {}) },
      };
      break;
    }
    case "strategy_artifacts": {
      const id = p.task_id as string;
      next.strategy_series = {
        ...snapshot.strategy_series,
        [id]: { ...(snapshot.strategy_series[id] ?? {}), ...(p.series ?? {}) },
      };
      break;
    }
    case "report_progress": {
      const id = p.task_id as string;
      next.report_progress = {
        ...snapshot.report_progress,
        [id]: { ...(snapshot.report_progress[id] ?? {}), ...(p.fields ?? {}) },
      };
      break;
    }
    case "node_update":
      if (p.state) next.state = { ...snapshot.state, ...(p.state as ParentState) };
      if (p.node === "clarify") next.interrupt = null;
      break;
    default:
      break;
  }
  return next;
}

export interface ProgressStep {
  label: string;
  detail: string;
  state: "done" | "active" | "pending" | "partial" | "failed";
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  market_data: "数据采集",
  analytics: "计算分析",
  investment_strategy: "策略与风险",
  report: "研究报告",
};

const RESULT_STATES: Record<string, ProgressStep["state"]> = {
  completed: "done",
  partial: "partial",
  failed: "failed",
  blocked: "failed",
  unsupported: "failed",
};

/** Port of backend app/progress.build_steps: planning → each planned task → composition. */
export function buildSteps(snapshot: RunSnapshot): ProgressStep[] {
  const state = snapshot.state;
  const planning = state.planning_status;
  if (state.followup_route === "direct_answer") {
    return [
      { label: "理解追问", detail: "已有信息足够，无需重新研究", state: "done" },
      { label: "解读已有结果", detail: "基于已有研究解释、总结或改写", state: state.final_response ? "done" : "active" },
    ];
  }
  if (state.followup_route === "routing" && !state.planning_status) {
    return [{ label: "理解问题", detail: "判断是否需要新研究", state: "active" }];
  }
  const attempt = Math.max(1, ...snapshot.planner_attempts.map((a) => Number(a.attempt ?? 1)));
  let planState: ProgressStep["state"];
  let detail: string;
  if (planning === "ready" || planning === "needs_clarification") {
    planState = "done";
    detail =
      planning === "ready"
        ? `已拆解为 ${state.plan?.tasks.length ?? 0} 个任务`
        : "问题需要澄清，未执行专家任务";
  } else if (planning === "failed") {
    planState = "failed";
    detail = "未能生成有效计划";
  } else {
    planState = "active";
    detail = attempt > 1 ? `第 ${attempt} 次规划（上次校验未通过，正在修正）` : "识别研究对象、时间范围与所需数据";
  }
  const steps: ProgressStep[] = [{ label: "理解问题并规划任务", detail, state: planState }];
  const results = state.task_results ?? {};
  const tasks = planning === "ready" ? state.plan?.tasks ?? [] : [];
  for (const task of tasks) {
    const record = results[task.task_id];
    const taskState: ProgressStep["state"] = record
      ? RESULT_STATES[record.status] ?? "failed"
      : task.task_id === snapshot.active_task
        ? "active"
        : "pending";
    steps.push({ label: CATEGORY_LABELS[task.category] ?? task.category, detail: task.question, state: taskState });
  }
  let compose: ProgressStep["state"];
  if (state.final_response) compose = "done";
  else if (
    ["completed", "partial", "failed"].includes(state.supervisor_status ?? "") ||
    planning === "needs_clarification" ||
    planning === "failed"
  )
    compose = "active";
  else compose = "pending";
  steps.push({ label: "汇总回答", detail: "整理结论、数据来源与局限说明", state: compose });
  return steps;
}

export function evidenceCount(state: ParentState): number {
  return Object.values(state.task_results ?? {}).reduce((sum, record) => {
    if (record.category !== "market_data") return sum;
    const evidence = (record.result as { evidence?: unknown[] } | null)?.evidence ?? [];
    return sum + evidence.length;
  }, 0);
}

export function runHeadline(snapshot: RunSnapshot): string {
  const planning = snapshot.state.planning_status;
  const key = planning === "failed" || planning === "needs_clarification" ? planning : snapshot.state.supervisor_status;
  const labels: Record<string, string> = {
    completed: "已完成",
    partial: "部分完成",
    failed: "未完成",
    needs_clarification: "需要补充信息",
  };
  if (snapshot.status === "cancelled") return "已停止";
  if (snapshot.status === "cancelling") return "正在停止";
  if (snapshot.status === "waiting_input") return "等待你的补充";
  if (snapshot.status === "queued" || snapshot.status === "running") return "进行中";
  return labels[key ?? ""] ?? (snapshot.status === "failed" ? "未完成" : "已完成");
}

/** A retry replays the whole saved plan, rather than asking the planner again. */
export function canRetryData(snapshot: RunSnapshot): boolean {
  if (!["completed", "failed", "cancelled"].includes(snapshot.status)) return false;
  const tasks = snapshot.state.plan?.tasks ?? [];
  if (!tasks.some((task) => task.category === "market_data")) return false;
  if (snapshot.status === "failed" || snapshot.status === "cancelled") return true;
  return Object.values(snapshot.state.task_results ?? {}).some((record) => {
    if (record.category !== "market_data") return false;
    const missing = (record.result as { missing_information?: string[] } | null)?.missing_information;
    return ["failed", "partial", "blocked"].includes(record.status) || Boolean(missing?.length);
  });
}
