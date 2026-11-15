"""Parent state: per-request outputs plus the thread-scoped turn history.

Per-request fields are rebuilt by `initialize` on every invocation. `turns` is the
only cross-turn channel; it accumulates under a checkpointer and is never reset.
"""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from typing_extensions import TypedDict

from src.orchestration.supervisor_state import ReportParameters
from src.orchestration.task_contracts import validate_task_results  # noqa: F401  # Public boundary helper.


class ParentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    user_query: str = Field(min_length=1)
    conversation_context: str = ""
    report_parameters: dict[str, ReportParameters] = Field(default_factory=dict)


class ConversationTurn(TypedDict):
    query: str
    response_preview: str
    status: str
    clarifications: list[str]
    completed_at: str


def add_turns(left: list[dict] | None, right: list[dict] | None) -> list[dict]:
    """Append-only reducer; a checkpointer makes this the durable thread history."""
    return list(left or []) + list(right or [])


def summarize_turns(turns: list[dict], *, limit: int = 3) -> str:
    """Planner context derived from stored turns; same shape the Streamlit shell used to build."""
    return "\n\n".join(f"用户：{turn['query'][:800]}\n回答摘要：{turn.get('response_preview', '')[:1200]}"
                       for turn in turns[-limit:])


class ParentState(TypedDict, total=False):
    user_query: str
    conversation_context: str
    turns: Annotated[list[dict], add_turns]
    clarification_rounds: int
    clarifications: list[str]
    report_parameters: dict[str, dict]
    plan: dict | None
    planning_status: Literal["ready", "needs_clarification", "failed"] | None
    planning_error: dict | None
    planning_attempts: int
    task_results: dict[str, dict]
    supervisor_status: Literal["running", "completed", "partial", "failed", "needs_clarification"] | None
    supervisor_error: dict | None
    final_response: str | None
    composition_status: Literal["completed", "fallback", "needs_clarification", "failed"] | None
    composition_error: dict | None
    composition_summary: str | None  # Model-written answer only; final_response also carries task details.


def create_parent_state(user_query: str, *, conversation_context: str = "",
                        report_parameters: dict | None = None) -> ParentState:
    """Validate request inputs and initialize fresh per-request outputs."""
    request = ParentRequest.model_validate({"user_query": user_query,
        "conversation_context": conversation_context,
        "report_parameters": {} if report_parameters is None else report_parameters})
    return {**request.model_dump(), "plan": None, "planning_status": None,
            "planning_error": None, "planning_attempts": 0, "task_results": {},
            "supervisor_status": None, "supervisor_error": None,
            "final_response": None, "composition_status": None, "composition_error": None,
            "composition_summary": None, "clarification_rounds": 0, "clarifications": []}
