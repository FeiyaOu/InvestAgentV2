from unittest.mock import Mock, patch

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

from src.orchestration.followup import answer_followup, route_followup
from src.orchestration.parent_graph import _record_turn, create_parent_graph


def context():
    return {"user_query": "解释Beta", "conversation_context": "历史", "recent_results": [
        {"source_id": "r1", "query": "计算Beta", "answer": "完整结果", "records": []}]}


def test_route_requires_valid_sources_and_fails_closed():
    chain = Mock()
    with patch("src.orchestration.followup._router_chain", return_value=chain):
        for raw in ({"route": "direct_answer", "reason": "解释", "source_ids": ["unknown"]},
                    {"route": "direct_answer", "reason": "解释", "source_ids": []}, {}):
            chain.invoke.return_value = raw
            assert route_followup(context())["followup_route"] == "planner"
        chain.invoke.side_effect = ValueError("invalid")
        assert route_followup(context())["followup_route"] == "planner"


def test_first_turn_skips_router():
    with patch("src.orchestration.followup._router_chain") as factory:
        assert route_followup({"user_query": "查行情"})["followup_route"] == "planner"
        factory.assert_not_called()


def test_insufficient_answer_returns_to_planner():
    chain = Mock()
    with patch("src.orchestration.followup._answer_chain", return_value=chain):
        state = {**context(), "followup_source_ids": ["r1"]}
        chain.invoke.return_value = {"needs_planner": True, "answer": ""}
        assert answer_followup(state)["followup_route"] == "planner"
        chain.invoke.side_effect = ValueError("invalid")
        assert answer_followup(state)["followup_route"] == "planner"


@pytest.fixture(params=["memory", "sqlite"])
def checkpoint(request):
    if request.param == "memory":
        yield InMemorySaver()
    else:
        with SqliteSaver.from_conn_string(":memory:") as saver:
            yield saver


def test_direct_followup_skips_research_and_retains_full_result(checkpoint):
    market, planner, composer, router, answer = [Mock() for _ in range(5)]
    market.invoke.return_value = {"status": "completed", "error": None, "result": {
        "answer": "Beta=0.8", "evidence_ids": [], "evidence": [], "missing_information": [], "dataset_refs": []}}
    planner.invoke.return_value = {"status": "ready", "clarification_questions": [], "tasks": [
        {"task_id": "m", "category": "market_data", "question": "查Beta", "depends_on": []}]}
    full = "完整结果" * 500
    composer.invoke.return_value = {"answer": full}
    router.invoke.side_effect = lambda p: {"route": "direct_answer", "reason": "解释",
                                         "source_ids": [p["results"][0]["source_id"]]}
    answer.invoke.return_value = {"needs_planner": False, "answer": "Beta是市场敏感度。"}
    with patch("src.orchestration.planner._create_chain", return_value=planner), \
         patch("src.orchestration.composer._create_chain", return_value=composer), \
         patch("src.orchestration.followup._router_chain", return_value=router), \
         patch("src.orchestration.followup._answer_chain", return_value=answer):
        graph = create_parent_graph(market_data_graph=market, checkpointer=checkpoint)
        cfg = {"configurable": {"thread_id": "followup"}}
        graph.invoke({"user_query": "查Beta"}, cfg)
        result = graph.invoke({"user_query": "解释Beta"}, cfg)
    assert planner.invoke.call_count == market.invoke.call_count == composer.invoke.call_count == 1
    assert full in answer.invoke.call_args.args[0]["results"][0]["answer"]
    assert result["composition_status"] == "completed"
    assert result["task_results"] == {} and result["plan"] is None
    assert len(result["turns"]) == 2
    assert result["turns"][-1]["response_preview"] == "Beta是市场敏感度。"


def test_answer_failure_reenters_planner_in_same_run():
    planner, router, answer, composer, market = [Mock() for _ in range(5)]
    planner.invoke.return_value = {"status": "ready", "clarification_questions": [], "tasks": [
        {"task_id": "m", "category": "market_data", "question": "补充证据", "depends_on": []}]}
    market.invoke.return_value = {"status": "completed", "error": None, "result": {
        "answer": "新证据", "evidence_ids": [], "evidence": [], "missing_information": [], "dataset_refs": []}}
    composer.invoke.return_value = {"answer": "补查完成"}
    router.invoke.return_value = {"route": "direct_answer", "reason": "解释", "source_ids": ["r1"]}
    answer.invoke.return_value = {"needs_planner": True, "answer": ""}
    with patch("src.orchestration.planner._create_chain", return_value=planner), \
         patch("src.orchestration.composer._create_chain", return_value=composer), \
         patch("src.orchestration.followup._router_chain", return_value=router), \
         patch("src.orchestration.followup._answer_chain", return_value=answer):
        result = create_parent_graph(market_data_graph=market).invoke(context())
    assert planner.invoke.call_count == market.invoke.call_count == 1
    assert result["final_response"].startswith("补查完成")


def test_result_memory_is_bounded_and_does_not_depend_on_summary():
    from src.orchestration.parent_state import retain_results
    results = [{"source_id": str(i)} for i in range(5)]
    assert retain_results(results[:3], results[3:]) == results[-3:]
    assert "recent_results" not in _record_turn({"user_query": "失败", "composition_status": "fallback"})


def test_explicit_research_route_and_router_exception_fall_back():
    chain = Mock()
    with patch("src.orchestration.followup._router_chain", return_value=chain):
        chain.invoke.return_value = {"route": "planner", "reason": "新增计算", "source_ids": []}
        assert route_followup(context())["followup_route"] == "planner"
        chain.invoke.side_effect = RuntimeError("provider unavailable")
        assert route_followup(context())["followup_route"] == "planner"


def test_answer_cannot_use_unknown_sources_or_empty_answer():
    chain = Mock()
    with patch("src.orchestration.followup._answer_chain", return_value=chain):
        assert answer_followup({**context(), "followup_source_ids": ["unknown"]})["followup_route"] == "planner"
        chain.invoke.assert_not_called()
        chain.invoke.return_value = {"needs_planner": False, "answer": " "}
        assert answer_followup({**context(), "followup_source_ids": ["r1"]})["followup_route"] == "planner"


def test_recall_stock_names_uses_legacy_history_without_complete_results():
    state = {"user_query": "我们在讨论的是哪两支股票", "conversation_context": "历史上下文",
             "turns": [{"query": "查茅台五粮液股价", "response_preview": "行情暂不可用"}]}
    router, answer = Mock(), Mock()
    router.invoke.side_effect = lambda p: {"route": "direct_answer", "reason": "回忆已讨论的标的",
                                          "source_ids": [p["results"][0]["source_id"]]}
    answer.invoke.return_value = {"needs_planner": False, "answer": "我们讨论的是贵州茅台和五粮液。"}
    with patch("src.orchestration.followup._router_chain", return_value=router), \
         patch("src.orchestration.followup._answer_chain", return_value=answer):
        decision = route_followup(state)
        assert decision["followup_route"] == "direct_answer"
        result = answer_followup({**state, **decision})
    assert "贵州茅台和五粮液" in result["final_response"]
    assert answer.invoke.call_args.args[0]["results"][0]["query"] == "查茅台五粮液股价"


def test_stateless_legacy_context_can_be_used_for_conversation_recall():
    router = Mock()
    router.invoke.side_effect = lambda p: {"route": "direct_answer", "reason": "回忆标的",
                                          "source_ids": [p["results"][0]["source_id"]]}
    with patch("src.orchestration.followup._router_chain", return_value=router):
        result = route_followup({"user_query": "我们讨论哪两只股票", "conversation_context": "用户：查茅台五粮液股价"})
    assert result["followup_route"] == "direct_answer"


def test_legacy_conversation_recall_bypasses_planner_after_initialize():
    router, answer = Mock(), Mock()
    router.invoke.side_effect = lambda p: {"route": "direct_answer", "reason": "回忆已提及标的",
                                          "source_ids": [p["results"][0]["source_id"]]}
    answer.invoke.return_value = {"needs_planner": False, "answer": "我们在讨论贵州茅台和五粮液。"}
    with patch("src.orchestration.followup._router_chain", return_value=router), \
         patch("src.orchestration.followup._answer_chain", return_value=answer), \
         patch("src.orchestration.parent_graph.planner") as planner:
        result = create_parent_graph().invoke({
            "user_query": "我们在讨论的是哪两支股票",
            "turns": [{"query": "查茅台五粮液股价", "response_preview": "数据未取得"}],
        })
    planner.assert_not_called()
    assert "茅台" in result["final_response"] and "五粮液" in result["final_response"]
    assert "查茅台五粮液股价" in router.invoke.call_args.args[0]["conversation_context"]
