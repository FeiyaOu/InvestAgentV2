"""Event normalizer: stream tuples → ordered events and a replayable RunView."""
from types import SimpleNamespace

from api.events import RunView, normalize, terminal_status

RESULT = {"m": {"task_id": "m", "category": "market_data", "question": "查询茅台价格", "depends_on": [],
                "status": "completed", "error": None,
                "result": {"answer": "100元", "evidence_ids": [], "evidence": [], "missing_information": []}}}
PLAN = {"status": "ready", "clarification_questions": [],
        "tasks": [{"task_id": "m", "category": "market_data", "question": "查询茅台价格", "depends_on": []}]}


def script():
    sup = ("supervisor:abc",)
    return [
        ((), "updates", {"initialize": {"user_query": "查茅台价格", "planning_status": None, "task_results": {}}}),
        ((), "custom", {"event": "planner_attempt", "attempt": 1, "status": "ok", "diagnostics": []}),
        ((), "updates", {"planner": {"plan": PLAN, "planning_status": "ready", "planning_attempts": 1}}),
        (sup, "updates", {"initialize": {"plan": PLAN}}),
        (sup, "custom", {"event": "task_started", "task_id": "m", "category": "market_data", "question": "查询茅台价格"}),
        (sup, "updates", {"supervisor": {"task_results": RESULT, "last_task_id": "m"}}),
        ((), "updates", {"supervisor": {"task_results": RESULT, "supervisor_status": "completed", "supervisor_error": None}}),
        ((), "updates", {"composer": {"final_response": "价格100元。", "composition_status": "completed"}}),
        ((), "updates", {"record_turn": {"turns": [{"query": "查茅台价格", "response_preview": "价格100元。",
                                                    "status": "completed", "clarifications": [], "completed_at": "t"}]}}),
    ]


def replay(items, view=None):
    view = view or RunView()
    events = []
    for namespace, mode, update in items:
        events.extend(normalize(view, namespace, mode, update))
    return view, events


def test_root_updates_build_parent_snapshot_and_nested_task_results_are_lifted():
    view, events = replay(script())
    assert view.state["planning_status"] == "ready"
    assert view.state["final_response"] == "价格100元。"
    assert view.state["task_results"] == RESULT
    assert "last_task_id" not in view.state  # nested-only channel stays local
    assert view.active_task == "m" and view.active_category == "market_data"
    assert view.planner_attempts[0]["attempt"] == 1
    kinds = [e["type"] for e in events]
    assert kinds.count("planner_attempt") == 1 and kinds.count("task_started") == 1
    assert kinds[-1] == "node_update" and events[-1]["payload"]["node"] == "record_turn"
    assert terminal_status(view) == "completed"


def test_nested_updates_carry_scope_and_active_task():
    _, events = replay(script())
    nested = [e for e in events if e["scope"].startswith("supervisor:")]
    assert nested and all(e["task_id"] == "m" for e in nested[1:])
    lifted = next(e for e in nested if e["payload"].get("node") == "supervisor")
    assert lifted["payload"]["state"] == {"task_results": RESULT}
    assert lifted["payload"]["details"]["tasks"][0]["status"] == "completed"


def test_report_subgraph_fields_become_report_progress():
    view = RunView()
    normalize(view, ("supervisor:x",), "custom", {"event": "task_started", "task_id": "r", "category": "report"})
    events = normalize(view, ("supervisor:x", "report:y"), "updates",
                       {"perception": {"perception_data": {"a": 1}, "messages": []}})
    assert view.report_progress == {"r": {"perception_data": {"a": 1}}}
    assert events[0]["type"] == "report_progress" and events[0]["payload"]["fields"] == {"perception_data": {"a": 1}}
    assert events[1]["type"] == "node_update" and "state" not in events[1]["payload"]


def test_artifacts_accumulate_per_task():
    view = RunView()
    normalize(view, ("s",), "custom", {"event": "analysis_artifacts", "task_id": "a", "artifacts": {"x": {"k": 1}}})
    normalize(view, ("s",), "custom", {"event": "analysis_artifacts", "task_id": "a", "artifacts": {"y": {"k": 2}}})
    normalize(view, ("s",), "custom", {"event": "strategy_artifacts", "task_id": "st", "series": {"p": [1, 2]}})
    assert set(view.analysis_snapshots["a"]) == {"x", "y"}
    assert view.strategy_series == {"st": {"p": [1, 2]}}


def test_interrupt_sets_waiting_and_clarify_clears_it():
    view = RunView()
    payload = {"type": "clarification", "questions": ["哪家公司？"], "round": 1, "max_rounds": 2}
    events = normalize(view, (), "updates", {"__interrupt__": (SimpleNamespace(value=payload),)})
    assert events[0]["type"] == "clarification_required" and events[0]["payload"] == payload
    assert terminal_status(view) == "waiting_input"
    normalize(view, (), "updates", {"clarify": {"user_query": "它多少钱？\n\n补充说明：茅台", "clarification_rounds": 1}})
    assert view.interrupt is None


def test_unknown_custom_events_and_non_dict_updates_are_ignored():
    view = RunView()
    assert normalize(view, (), "custom", {"event": "something_else"}) == []
    assert normalize(view, (), "custom", "text") == []
    assert normalize(view, (), "values", {"x": 1}) == []
    assert normalize(view, (), "updates", {"node": "not-a-dict"}) == []


def test_terminal_status_without_answer_is_failed():
    view = RunView(state={"planning_status": "failed"})
    assert terminal_status(view) == "failed"
    view.state["final_response"] = "未能生成任务计划"
    assert terminal_status(view) == "completed"
