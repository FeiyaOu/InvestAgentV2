"""Public entrypoints for the Planner/Supervisor/Composer graph.

run_invest_agent stays request-local with caller-supplied context. Durable
multi-turn threads come from create_invest_agent(checkpointer=...). Legacy
processing_mode and top-level report outputs are not part of this API.
"""
from langchain_core.runnables import RunnableConfig

from src.orchestration.parent_graph import create_parent_graph


def create_invest_agent(*, checkpointer=None):
    """Return the canonical parent graph.

    Stateless by default. Pass a LangGraph checkpointer (SqliteSaver locally,
    PostgresSaver in production) to get durable threads: invoke with
    config={"configurable": {"thread_id": ...}} and the thread accumulates turns,
    derives planner context from them, and suspends clarification via interrupt.
    """
    return create_parent_graph(checkpointer=checkpointer)


def run_invest_agent(user_query: str, *, conversation_context: str = "",
                     report_parameters: dict | None = None,
                     config: RunnableConfig | None = None) -> dict:
    """Run a fresh request; callers explicitly supply conversation context.

    Config controls callbacks/tags, not automatic conversation persistence.
    """
    return create_invest_agent().invoke({
        "user_query": user_query, "conversation_context": conversation_context,
        "report_parameters": {} if report_parameters is None else report_parameters,
    }, config=config)
