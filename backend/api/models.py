"""Business tables. Checkpoint tables live in the same database but are owned by LangGraph."""
from datetime import datetime, timezone

from sqlalchemy import Column, Text
from sqlmodel import JSON, Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: str = Field(primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    display_name: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"
    id: str = Field(primary_key=True)  # Also the LangGraph thread_id.
    user_id: str = Field(index=True, foreign_key="users.id")
    title: str = ""
    turn_count: int = 0
    last_status: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Run(SQLModel, table=True):
    __tablename__ = "runs"
    run_id: str = Field(primary_key=True)
    conversation_id: str = Field(index=True, foreign_key="conversations.id")
    user_id: str = Field(index=True, foreign_key="users.id")
    query: str = Field(sa_column=Column(Text))
    status: str = "queued"
    created_at: datetime = Field(default_factory=utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    elapsed_seconds: float | None = None
    error: dict | None = Field(default=None, sa_column=Column(JSON))
    snapshot: dict | None = Field(default=None, sa_column=Column(JSON))  # RunView at the last terminal state.
    event_count: int = 0


class RunEventRow(SQLModel, table=True):
    __tablename__ = "run_events"
    id: int | None = Field(default=None, primary_key=True)
    run_id: str = Field(index=True, foreign_key="runs.run_id")
    seq: int
    type: str
    at: str
    scope: str
    task_id: str | None = None
    category: str | None = None
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Report(SQLModel, table=True):
    __tablename__ = "reports"
    id: str = Field(primary_key=True)
    run_id: str = Field(index=True, foreign_key="runs.run_id")
    task_id: str
    user_id: str = Field(index=True, foreign_key="users.id")
    conversation_id: str = Field(index=True, foreign_key="conversations.id")
    question: str = Field(sa_column=Column(Text))
    title: str = ""
    industry_focus: str = ""
    time_horizon: str = ""
    report_date: str = ""
    overall_rating: str = ""
    status: str  # Task status: completed | partial.
    draft: bool = False
    report: dict = Field(default_factory=dict, sa_column=Column(JSON))
    validation_errors: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)
