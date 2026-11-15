"""Pure event normalizer: LangGraph stream tuples → ordered, JSON-friendly run events.

Ported from the Streamlit `_run` loop so both shells agree on what a run looks like.
`RunView` is the mutable snapshot a consumer rebuilds by replaying events in order.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone

REPORT_FIELDS = ("perception_data", "world_model", "reasoning_plans", "selected_plan")
CUSTOM_EVENTS = {"planner_attempt", "task_started", "analysis_artifacts", "strategy_artifacts",
                 "strategy_diagnostic", "analytics_diagnostic"}
_DEBUG_KEYS = ("plan", "planning_status", "planning_attempts", "planning_error", "last_task_id",
               "supervisor_status", "supervisor_error", "tool_rounds", "tool_calls_used",
               "output_retries", "status", "error")


@dataclass
class RunView:
    state: dict = field(default_factory=dict)
    report_progress: dict[str, dict] = field(default_factory=dict)
    analysis_snapshots: dict[str, dict] = field(default_factory=dict)
    strategy_series: dict[str, dict] = field(default_factory=dict)
    planner_attempts: list[dict] = field(default_factory=list)
    active_task: str | None = None
    active_category: str | None = None
    interrupt: dict | None = None

    def snapshot(self) -> dict:
        return {"state": self.state, "report_progress": self.report_progress,
                "analysis_snapshots": self.analysis_snapshots, "strategy_series": self.strategy_series,
                "planner_attempts": self.planner_attempts, "active_task": self.active_task,
                "active_category": self.active_category, "interrupt": self.interrupt}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def debug_details(values: dict) -> dict:
    """Copy only observable node output; exclude provider metadata and report text."""
    details = {key: values[key] for key in _DEBUG_KEYS if key in values}
    if "messages" in values:
        details["messages"] = []
        for msg in values["messages"]:
            role = getattr(msg, "type", "unknown")
            if role == "system":
                continue
            item = {"role": role, "content": getattr(msg, "content", "")}
            if getattr(msg, "tool_calls", None):
                item["tool_calls"] = msg.tool_calls
            if getattr(msg, "tool_call_id", None):
                item["tool_call_id"] = msg.tool_call_id
            details["messages"].append(item)
    result = values.get("result")
    if isinstance(result, dict) and "answer" in result and "evidence_ids" in result:
        details["validated_result"] = {key: result.get(key) for key in ("answer", "evidence_ids", "missing_information", "dataset_refs")}
    if "task_results" in values:
        details["tasks"] = [{"task_id": ident, "category": r["category"], "depends_on": r["depends_on"],
                             "status": r["status"], "error": r.get("error")}
                            for ident, r in values["task_results"].items()]
    return details


def _event(kind: str, view: RunView, scope: str, payload: dict, task_id=None, category=None) -> dict:
    return {"type": kind, "at": _now(), "scope": scope, "task_id": task_id, "category": category, "payload": payload}


def normalize(view: RunView, namespace: tuple, mode: str, update) -> list[dict]:
    """Apply one stream tuple to `view` and return the events it produced (possibly none)."""
    scope = "/".join(namespace) or "parent"
    if mode == "custom":
        if not isinstance(update, dict) or update.get("event") not in CUSTOM_EVENTS:
            return []
        kind = update["event"]
        if kind == "planner_attempt":
            view.planner_attempts.append(update)
        elif kind == "task_started":
            view.active_task, view.active_category = update.get("task_id"), update.get("category")
        elif kind == "analysis_artifacts":
            view.analysis_snapshots.setdefault(update["task_id"], {}).update(update.get("artifacts", {}))
        elif kind == "strategy_artifacts":
            view.strategy_series.setdefault(update["task_id"], {}).update(update.get("series", {}))
        task_id = update.get("task_id", view.active_task)
        category = update.get("category", view.active_category if update.get("task_id") in (None, view.active_task) else None)
        return [_event(kind, view, scope, update, task_id=task_id, category=category)]
    if mode != "updates" or not isinstance(update, dict):
        return []
    events = []
    for node, values in update.items():
        if node == "__interrupt__":
            payload = values[0].value if isinstance(values, (list, tuple)) and values else values
            view.interrupt = payload if isinstance(payload, dict) else {"value": payload}
            events.append(_event("clarification_required", view, scope, view.interrupt))
            continue
        if not isinstance(values, dict):
            continue
        state_delta = {}
        if not namespace:
            # Only root updates enter the parent snapshot. Nested channels stay local.
            view.state.update(values)
            state_delta = values
            if node == "clarify":
                view.interrupt = None
        elif "task_results" in values:
            view.state["task_results"] = values["task_results"]
            state_delta = {"task_results": values["task_results"]}
        task_id = view.active_task if namespace else None
        category = view.active_category if namespace else None
        if namespace and view.active_category == "report":
            fields = {key: values[key] for key in REPORT_FIELDS if key in values}
            if fields:
                view.report_progress.setdefault(view.active_task, {}).update(fields)
                events.append(_event("report_progress", view, scope, {"task_id": view.active_task, "fields": fields},
                                     task_id=task_id, category=category))
        payload = {"node": node, "details": debug_details(values)}
        if state_delta:
            payload["state"] = state_delta
        events.append(_event("node_update", view, scope, payload, task_id=task_id, category=category))
    return events


def terminal_status(view: RunView) -> str:
    """Map the final parent snapshot onto the run's terminal status."""
    if view.interrupt:
        return "waiting_input"
    state = view.state
    if state.get("planning_status") in {"failed", "needs_clarification"}:
        return "completed" if state.get("final_response") else "failed"
    if state.get("supervisor_status") in {"completed", "partial"} and state.get("final_response"):
        return "completed"
    if state.get("final_response"):
        return "completed"
    return "failed"
