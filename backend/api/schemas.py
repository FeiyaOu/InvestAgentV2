"""Request/response contracts for the HTTP layer."""
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CreateRunRequest(StrictModel):
    query: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_\-]+$")


class ResumeRunRequest(StrictModel):
    answer: str = Field(min_length=1, max_length=2000)


class RunCreated(StrictModel):
    run_id: str
    conversation_id: str
    status: str


class RunEvent(StrictModel):
    model_config = ConfigDict(extra="allow")
    seq: int
    run_id: str
    type: str
    at: str
    scope: str
    task_id: str | None = None
    category: str | None = None
    payload: dict


class ConversationTurn(StrictModel):
    run_id: str
    model_config = ConfigDict(extra="allow")
    query: str
    response_preview: str
    status: str
    completed_at: str


class ConversationView(StrictModel):
    conversation_id: str
    turns: list[ConversationTurn]
    runs: list[dict]
