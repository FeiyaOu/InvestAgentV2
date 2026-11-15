"""Durable multi-turn threads: turns accumulate under a checkpointer, clarification suspends via interrupt."""
from unittest.mock import Mock, patch

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command

from src.agent import create_invest_agent, run_invest_agent
from src.orchestration.parent_graph import MAX_CLARIFICATION_ROUNDS, create_parent_graph
from src.orchestration.parent_state import create_parent_state, summarize_turns

READY = {"status": "ready", "clarification_questions": [],
         "tasks": [{"task_id": "m", "category": "market_data", "question": "查询茅台价格", "depends_on": []}]}
CLARIFY = {"status": "needs_clarification", "tasks": [], "clarification_questions": ["哪家公司？"]}


def market():
    graph = Mock()
    graph.invoke.return_value = {"status": "completed", "error": None, "result": {
        "answer": "100元", "evidence_ids": [], "evidence": [], "missing_information": []}}
    return graph


def thread(ident="t1"):
    return {"configurable": {"thread_id": ident}}


def build(plans, checkpointer):
    """Parent graph with mocked planner/composer chains; planner answers follow `plans` in order."""
    planning, composing = Mock(), Mock()
    planning.invoke.side_effect = list(plans)
    composing.invoke.return_value = {"answer": "查询到价格100元。"}
    graph = create_parent_graph(market_data_graph=market(), report_graph=Mock(), checkpointer=checkpointer)
    patches = (patch("src.orchestration.planner._create_chain", return_value=planning),
               patch("src.orchestration.composer._create_chain", return_value=composing))
    return graph, planning, patches


def test_state_factory_does_not_own_turns():
    state = create_parent_state("查询")
    assert "turns" not in state
    assert state["clarification_rounds"] == 0


def test_summarize_turns_keeps_last_three_in_streamlit_format():
    turns = [{"query": f"问题{i}", "response_preview": f"回答{i}", "status": "completed",
              "completed_at": "2026-11-15T00:00:00+00:00"} for i in range(5)]
    summary = summarize_turns(turns)
    assert "问题1" not in summary and "问题2" in summary and "问题4" in summary
    assert summary.startswith("用户：问题2\n回答摘要：回答2")
    assert summarize_turns([]) == ""


def test_second_turn_on_same_thread_receives_derived_context_and_accumulates_turns():
    with SqliteSaver.from_conn_string(":memory:") as saver:
        graph, planning, patches = build([READY, READY], saver)
        with patches[0], patches[1]:
            first = graph.invoke({"user_query": "查茅台价格"}, config=thread())
            second = graph.invoke({"user_query": "它的PE呢？"}, config=thread())
    assert len(first["turns"]) == 1 and len(second["turns"]) == 2
    assert second["turns"][0]["query"] == "查茅台价格"
    assert "100元" in second["turns"][0]["response_preview"]
    assert second["turns"][1]["query"] == "它的PE呢？"
    context = planning.invoke.call_args_list[1].args[0]["conversation_context"]
    assert "用户：查茅台价格" in context and "100元" in context
    # Per-request outputs are rebuilt, not carried over from the previous turn.
    assert planning.invoke.call_args_list[0].args[0]["conversation_context"] == ""


def test_threads_are_isolated():
    with SqliteSaver.from_conn_string(":memory:") as saver:
        graph, planning, patches = build([READY, READY], saver)
        with patches[0], patches[1]:
            graph.invoke({"user_query": "查茅台价格"}, config=thread("a"))
            other = graph.invoke({"user_query": "查五粮液价格"}, config=thread("b"))
    assert len(other["turns"]) == 1
    assert planning.invoke.call_args_list[1].args[0]["conversation_context"] == ""


def test_explicit_context_is_used_only_when_thread_has_no_turns():
    with SqliteSaver.from_conn_string(":memory:") as saver:
        graph, planning, patches = build([READY, READY], saver)
        with patches[0], patches[1]:
            graph.invoke({"user_query": "查茅台价格", "conversation_context": "外部摘要"}, config=thread())
            graph.invoke({"user_query": "它的PE呢？", "conversation_context": "过期摘要"}, config=thread())
    contexts = [call.args[0]["conversation_context"] for call in planning.invoke.call_args_list]
    assert contexts[0] == "外部摘要"
    assert "过期摘要" not in contexts[1] and "查茅台价格" in contexts[1]


def test_clarification_interrupts_then_resumes_with_user_answer():
    with SqliteSaver.from_conn_string(":memory:") as saver:
        graph, planning, patches = build([CLARIFY, READY], saver)
        with patches[0], patches[1]:
            paused = graph.invoke({"user_query": "它多少钱？"}, config=thread())
            assert "__interrupt__" in paused
            payload = paused["__interrupt__"][0].value
            assert payload["type"] == "clarification" and payload["questions"] == ["哪家公司？"]
            assert paused.get("final_response") is None and paused.get("turns", []) == []
            resumed = graph.invoke(Command(resume="贵州茅台"), config=thread())
    replanned = planning.invoke.call_args_list[1].args[0]["user_query"]
    assert "它多少钱？" in replanned and "贵州茅台" in replanned
    assert resumed["supervisor_status"] == "completed"
    assert "100元" in resumed["final_response"]
    assert len(resumed["turns"]) == 1 and resumed["turns"][0]["clarifications"] == ["贵州茅台"]


def test_blank_clarification_answer_asks_again_without_replanning():
    with InMemorySaver() as saver:
        graph, planning, patches = build([CLARIFY, READY], saver)
        with patches[0], patches[1]:
            graph.invoke({"user_query": "它多少钱？"}, config=thread())
            again = graph.invoke(Command(resume="   "), config=thread())
            assert "__interrupt__" in again
            assert planning.invoke.call_count == 1
            done = graph.invoke(Command(resume="贵州茅台"), config=thread())
    assert done["supervisor_status"] == "completed"


def test_clarification_rounds_are_bounded():
    plans = [CLARIFY] * (MAX_CLARIFICATION_ROUNDS + 1)
    with InMemorySaver() as saver:
        graph, planning, patches = build(plans, saver)
        with patches[0], patches[1]:
            result = graph.invoke({"user_query": "它多少钱？"}, config=thread())
            for _ in range(MAX_CLARIFICATION_ROUNDS):
                assert "__interrupt__" in result
                result = graph.invoke(Command(resume="还是不知道"), config=thread())
    assert "__interrupt__" not in result
    assert result["composition_status"] == "needs_clarification"
    assert "哪家公司" in result["final_response"]
    assert planning.invoke.call_count == MAX_CLARIFICATION_ROUNDS + 1
    assert result["turns"][0]["status"] == "needs_clarification"


def test_without_checkpointer_clarification_still_returns_questions_inline():
    graph, planning, patches = build([CLARIFY], None)
    with patches[0], patches[1]:
        result = graph.invoke({"user_query": "它多少钱？"})
    assert "__interrupt__" not in result
    assert result["composition_status"] == "needs_clarification"
    assert "clarify" not in graph.get_graph().nodes


def test_invalid_input_on_thread_leaves_history_untouched():
    with InMemorySaver() as saver:
        graph, _, patches = build([READY], saver)
        with patches[0], patches[1]:
            graph.invoke({"user_query": "查茅台价格"}, config=thread())
            bad = graph.invoke({"user_query": "  "}, config=thread())
    assert bad["planning_error"]["type"] == "invalid_input"
    assert len(bad["turns"]) == 1


def test_public_facade_accepts_checkpointer_and_stays_stateless_by_default():
    assert create_invest_agent().checkpointer is None
    with InMemorySaver() as saver:
        assert create_invest_agent(checkpointer=saver).checkpointer is saver
    with pytest.raises(TypeError):
        run_invest_agent("查询", thread_id="x")
