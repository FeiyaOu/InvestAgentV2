import { describe, expect, it } from "vitest";
import { applyEvent, buildSteps, emptySnapshot, evidenceCount, runHeadline } from "./runView";
import type { RunEvent, TaskPlan } from "./types";

const PLAN: TaskPlan = {
  status: "ready",
  clarification_questions: [],
  tasks: [
    { task_id: "m", category: "market_data", question: "查询茅台价格", depends_on: [] },
    { task_id: "a", category: "analytics", question: "计算收益", depends_on: ["m"] },
  ],
};

let seq = 0;
function ev(type: string, payload: Record<string, unknown>, extra: Partial<RunEvent> = {}): RunEvent {
  seq += 1;
  return { seq, run_id: "r", type, at: "2026-11-15T00:00:00Z", scope: "parent", task_id: null, category: null, payload, ...extra };
}

describe("applyEvent", () => {
  it("replays a run from queued to completed, merging only state deltas", () => {
    seq = 0;
    let s = emptySnapshot("r", "c", "查茅台价格");
    s = applyEvent(s, ev("run_started", { resumed: false }));
    expect(s.status).toBe("running");
    s = applyEvent(s, ev("node_update", { node: "planner", state: { plan: PLAN, planning_status: "ready" } }));
    s = applyEvent(s, ev("task_started", { task_id: "m", category: "market_data" }));
    expect(buildSteps(s).map((x) => x.state)).toEqual(["done", "active", "pending", "pending"]);
    s = applyEvent(
      s,
      ev("node_update", {
        node: "supervisor",
        state: {
          task_results: {
            m: { ...PLAN.tasks[0], status: "completed", error: null, result: { answer: "100元", evidence: [{}, {}], evidence_ids: [], missing_information: [] } },
          },
        },
      }),
    );
    expect(evidenceCount(s.state)).toBe(2);
    s = applyEvent(s, ev("node_update", { node: "composer", state: { final_response: "ok", supervisor_status: "partial" } }));
    s = applyEvent(s, ev("run_finished", { status: "completed", error: null, elapsed_seconds: 9.5 }));
    expect(s.status).toBe("completed");
    expect(s.elapsed_seconds).toBe(9.5);
    expect(s.event_count).toBe(seq);
    expect(runHeadline(s)).toBe("部分完成");
    expect(buildSteps(s).map((x) => x.state)).toEqual(["done", "done", "pending", "done"]);
  });

  it("ignores stale or duplicate events by seq", () => {
    seq = 0;
    const base = applyEvent(emptySnapshot("r", "c", "q"), ev("run_started", {}));
    const again = applyEvent(base, { ...ev("run_finished", { status: "failed" }), seq: 1 });
    expect(again).toBe(base);
  });

  it("accumulates artifacts per task and clears the interrupt on clarify", () => {
    seq = 0;
    let s = emptySnapshot("r", "c", "q");
    s = applyEvent(s, ev("analysis_artifacts", { task_id: "a", artifacts: { x: { analysis_id: "x" } } }));
    s = applyEvent(s, ev("analysis_artifacts", { task_id: "a", artifacts: { y: { analysis_id: "y" } } }));
    expect(Object.keys(s.analysis_snapshots.a)).toEqual(["x", "y"]);
    s = applyEvent(s, ev("report_progress", { task_id: "rep", fields: { perception_data: 1 } }));
    expect(s.report_progress.rep).toEqual({ perception_data: 1 });
    const interrupt = { type: "clarification", questions: ["哪家公司？"], round: 1, max_rounds: 2 };
    s = applyEvent(s, ev("clarification_required", interrupt));
    s = applyEvent(s, ev("run_waiting", { status: "waiting_input" }));
    expect(s.status).toBe("waiting_input");
    expect(s.interrupt).toEqual(interrupt);
    expect(runHeadline(s)).toBe("等待你的补充");
    s = applyEvent(s, ev("clarification_answered", { answer: "茅台" }));
    expect(s.interrupt).toBeNull();
    expect(s.status).toBe("queued");
  });
});

describe("buildSteps", () => {
  it("describes clarification and failed planning", () => {
    const needs = emptySnapshot("r", "c", "q");
    needs.state = { planning_status: "needs_clarification", plan: { status: "needs_clarification", tasks: [], clarification_questions: ["?"] } };
    expect(buildSteps(needs)[0].detail).toContain("澄清");
    const failed = emptySnapshot("r", "c", "q");
    failed.state = { planning_status: "failed" };
    failed.planner_attempts = [{ attempt: 1 }, { attempt: 2 }];
    expect(buildSteps(failed)[0].state).toBe("failed");
    const retrying = emptySnapshot("r", "c", "q");
    retrying.planner_attempts = [{ attempt: 2 }];
    expect(buildSteps(retrying)[0].detail).toContain("第 2 次规划");
  });
});

it("shows cancellation distinctly and clears a stale clarification when stopped", () => {
  seq = 0;
  let s = emptySnapshot("r", "c", "q");
  s = applyEvent(s, ev("clarification_required", { type: "clarification", questions: ["哪只股票"], round: 1, max_rounds: 2 }));
  s = applyEvent(s, ev("run_cancelling", {}));
  expect(runHeadline(s)).toBe("正在停止");
  s = applyEvent(s, ev("run_finished", { status: "cancelled", elapsed_seconds: 4 }));
  expect(runHeadline(s)).toBe("已停止");
  expect(s.interrupt).toBeNull();
  expect(s.error).toBeNull();
});

it("shows direct follow-up progress without a planner step", () => {
  let s = emptySnapshot("r", "c", "解释Beta");
  s = applyEvent(s, ev("node_update", { node: "route_followup", state: { followup_route: "direct_answer" } }));
  expect(buildSteps(s).map((step) => step.label)).toEqual(["理解追问", "解读已有结果"]);
  expect(buildSteps(s).map((step) => step.state)).toEqual(["done", "active"]);
  s = applyEvent(s, ev("node_update", { node: "followup_answer", state: { final_response: "解释完成" } }));
  expect(buildSteps(s).every((step) => step.state === "done")).toBe(true);
});
