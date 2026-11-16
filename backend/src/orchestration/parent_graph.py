"""Planner → Supervisor → Composer parent graph with an optional durable thread.

Without a checkpointer the graph is request-local, exactly as before. With one, the
same thread_id accumulates `turns`, planner context is derived from them, and
clarification suspends the run with `interrupt` until the caller resumes.
"""
from datetime import datetime, timezone

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt
from pydantic import ValidationError

from src.core.datasets import DatasetStore
from src.orchestration.composer import composer
from src.orchestration.history import compact_history
from src.orchestration.parent_state import (
    ParentState,
    build_conversation_context,
    create_parent_state,
    extract_facts,
)
from src.orchestration.planner import planner
from src.orchestration.planner_schemas import TaskPlan
from src.orchestration.supervisor import create_supervisor_graph
from src.orchestration.task_contracts import validate_task_results
from src.specialists.analytics.artifacts import AnalysisStore
from src.specialists.strategy.artifacts import StrategyStore

MAX_CLARIFICATION_ROUNDS = 2
PREVIEW_CHARS = 1200


def _initialize(state: ParentState) -> dict:
    """Rebuild every per-request field; thread channels are deliberately absent so their reducers keep them."""
    turns = state.get("turns") or []
    # A stored thread outranks caller-supplied context, which may be stale on later turns.
    context = (build_conversation_context(turns, state.get("conversation_facts"), state.get("history_summary"))
               if turns else state.get("conversation_context", ""))
    try:
        return create_parent_state(state.get("user_query"), conversation_context=context,
                                   report_parameters=state.get("report_parameters"))
    except ValidationError:
        # Clear every previous execution output even when input validation fails.
        clean = create_parent_state("无效输入")
        return {**clean, "user_query": "", "planning_status": "failed",
                "planning_error": {"type": "invalid_input", "message": "请输入非空问题，并检查上下文和报告参数格式。"}}


def _clarify(state: ParentState) -> dict:
    """Suspend until the caller answers; re-ask on blank answers without spending a round."""
    questions = (state.get("plan") or {}).get("clarification_questions", [])
    payload = {"type": "clarification", "questions": questions,
               "round": state.get("clarification_rounds", 0) + 1, "max_rounds": MAX_CLARIFICATION_ROUNDS}
    answer = interrupt(payload)
    while not isinstance(answer, str) or not answer.strip():
        answer = interrupt({**payload, "error": "请输入非空的补充说明。"})
    answer = answer.strip()
    return {"user_query": f"{state['user_query']}\n\n补充说明：{answer}",
            "clarifications": [*state.get("clarifications", []), answer],
            "clarification_rounds": state.get("clarification_rounds", 0) + 1,
            "plan": None, "planning_status": None, "planning_error": None, "planning_attempts": 0}


def _record_turn(state: ParentState) -> dict:
    """Append this request to the thread history; invalid input never becomes a turn."""
    if not state.get("user_query"):
        return {}
    status = state.get("supervisor_status") or state.get("planning_status") or state.get("composition_status") or "failed"
    # Prefer the composer's answer: final_response appends per-task details that would crowd out the conclusion.
    preview = state.get("composition_summary") or state.get("final_response") or ""
    update = {"turns": [{"query": state["user_query"], "response_preview": preview[:PREVIEW_CHARS],
                         "status": status, "clarifications": list(state.get("clarifications", [])),
                         "completed_at": datetime.now(timezone.utc).isoformat()}]}
    facts = extract_facts(state.get("plan"), state.get("task_results"))
    if facts:
        update["conversation_facts"] = facts
    return update


def create_parent_graph(*, market_data_graph=None, report_graph=None, analytics_graph=None, strategy_graph=None,
                        checkpointer=None):
    """Build the parent graph; pass a checkpointer to enable durable threads and interrupt clarification.

    invoke({"user_query": ...}) runs the full pipeline. stream(..., subgraphs=True)
    exposes execution progress. Resume a clarification with Command(resume=answer).
    """
    execution = create_supervisor_graph(market_data_graph=market_data_graph, report_graph=report_graph, analytics_graph=analytics_graph, strategy_graph=strategy_graph)

    def supervise(state: ParentState, config: RunnableConfig) -> dict:
        try:
            # Store is runtime context, never a graph-state field or model argument.
            child_config = dict(config)
            child_config["configurable"] = {**config.get("configurable", {}), "dataset_store": DatasetStore(), "analysis_store": AnalysisStore(), "strategy_store": StrategyStore()}
            output = execution.invoke({"plan": state["plan"],
                                       "conversation_context": state.get("conversation_context", ""),
                                       "report_parameters": state["report_parameters"]}, config=child_config)
            results = validate_task_results(output["task_results"])
            planned = {task["task_id"]: task for task in state["plan"]["tasks"]}
            # Validate identities against this plan, not only the result-map keys.
            for ident, result in results.items():
                if ident not in planned or any(result[key] != value for key, value in planned[ident].items()):
                    raise ValueError("任务结果与本轮计划不一致")
            if output["supervisor_status"] in {"completed", "partial"} and set(results) != set(planned):
                raise ValueError("缺少终止任务结果")
            return {"task_results": results, "supervisor_status": output["supervisor_status"],
                    "supervisor_error": output["supervisor_error"]}
        except Exception:
            return {"task_results": {}, "supervisor_status": "failed",
                    "supervisor_error": {"type": "execution_error", "message": "任务执行边界异常，请重试。"}}

    def plan(state: ParentState) -> dict:
        update = planner(state)
        if update["planning_status"] in {"ready", "needs_clarification"}:
            # The existing planner already validates; keep the graph boundary explicit.
            checked = TaskPlan.model_validate(update["plan"])
            return {**update, "plan": checked.to_state()}
        return update

    interactive = checkpointer is not None

    def after_planner(state: ParentState) -> str:
        if state["planning_status"] == "ready":
            return "supervisor"
        if (interactive and state["planning_status"] == "needs_clarification"
                and state.get("clarification_rounds", 0) < MAX_CLARIFICATION_ROUNDS):
            return "clarify"
        return "composer"

    graph = StateGraph(ParentState)
    graph.add_node("initialize", _initialize)
    graph.add_node("planner", plan)
    graph.add_node("supervisor", supervise)
    graph.add_node("composer", composer)
    graph.add_node("record_turn", _record_turn)
    graph.add_node("compact_history", compact_history)
    graph.add_edge(START, "initialize")
    graph.add_conditional_edges("initialize", lambda s: "composer" if s["planning_status"] == "failed" else "planner",
                                {"composer": "composer", "planner": "planner"})
    routes = {"supervisor": "supervisor", "composer": "composer"}
    if interactive:
        graph.add_node("clarify", _clarify)
        graph.add_edge("clarify", "planner")
        routes["clarify"] = "clarify"
    graph.add_conditional_edges("planner", after_planner, routes)
    graph.add_edge("supervisor", "composer")
    graph.add_edge("composer", "record_turn")
    graph.add_edge("record_turn", "compact_history")
    graph.add_edge("compact_history", END)
    return graph.compile(checkpointer=checkpointer)
