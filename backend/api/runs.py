"""Run records, the database-backed store, and the thread-pool runner around the parent graph.

Live runs are held in memory for low-latency SSE; every event is also written through to
run_events, and the terminal RunView is stored on the run row so a restarted process can
still serve GET /runs/{id} and replay its events.
"""
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

from langgraph.types import Command

from api import repository
from api.db import session_scope
from api.events import RunView, normalize, terminal_status

TERMINAL = {"completed", "failed", "waiting_input"}
RESTART_MESSAGE = "服务重启，运行中断；已保留已产生的事件，请重新提问。"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def jsonable(value):
    """Events may carry pydantic models or messages; degrade to strings rather than fail."""
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


@dataclass
class RunRecord:
    run_id: str
    conversation_id: str
    user_id: str
    query: str
    status: str = "queued"
    created_at: str = field(default_factory=_now)
    started_at: str | None = None
    finished_at: str | None = None
    error: dict | None = None
    events: list[dict] = field(default_factory=list)
    view: RunView = field(default_factory=RunView)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    store: "RunStore | None" = field(default=None, repr=False)
    _started_monotonic: float | None = field(default=None, repr=False)
    _elapsed_final: float | None = field(default=None, repr=False)

    def append(self, event: dict) -> dict:
        with self.lock:
            event = {"seq": len(self.events) + 1, "run_id": self.run_id, "at": _now(), **jsonable(event)}
            self.events.append(event)
        if self.store is not None:
            self.store.persist_event(self.run_id, event)
        return event

    def events_after(self, seq: int) -> list[dict]:
        with self.lock:
            return self.events[seq:]

    def elapsed(self) -> float | None:
        if self._elapsed_final is not None:
            return round(self._elapsed_final, 1)
        if self._started_monotonic is None:
            return None
        return round(time.monotonic() - self._started_monotonic, 1)

    def snapshot(self) -> dict:
        with self.lock:
            return jsonable({"run_id": self.run_id, "conversation_id": self.conversation_id, "query": self.query,
                             "status": self.status, "created_at": self.created_at, "started_at": self.started_at,
                             "finished_at": self.finished_at, "error": self.error, "elapsed_seconds": self.elapsed(),
                             "event_count": len(self.events), **self.view.snapshot()})


def _record_from_row(row: dict, events: list[dict]) -> RunRecord:
    """Rebuild a finished run from storage; the stored RunView is authoritative, events are for replay."""
    view = RunView()
    snapshot = row.get("snapshot") or {}
    view.state = snapshot.get("state", {})
    view.report_progress = snapshot.get("report_progress", {})
    view.analysis_snapshots = snapshot.get("analysis_snapshots", {})
    view.strategy_series = snapshot.get("strategy_series", {})
    view.planner_attempts = snapshot.get("planner_attempts", [])
    view.active_task = snapshot.get("active_task")
    view.active_category = snapshot.get("active_category")
    view.interrupt = snapshot.get("interrupt")
    record = RunRecord(run_id=row["run_id"], conversation_id=row["conversation_id"], user_id=row["user_id"],
                       query=row["query"], status=row["status"], created_at=row["created_at"],
                       started_at=row["started_at"], finished_at=row["finished_at"], error=row["error"],
                       events=events, view=view)
    record._elapsed_final = row.get("elapsed_seconds")
    return record


class RunStore:
    """Live records in memory, everything written through to the database."""

    def __init__(self, engine):
        self.engine = engine
        self._live: dict[str, RunRecord] = {}
        self._lock = threading.Lock()

    def create(self, *, query: str, conversation_id: str | None, user_id: str) -> RunRecord:
        with session_scope(self.engine) as session:
            conversation = repository.ensure_conversation(session, conversation_id=conversation_id, user_id=user_id,
                                                          title_hint=query)
            record = RunRecord(run_id="run_" + uuid4().hex, conversation_id=conversation.id, user_id=user_id,
                               query=query, store=self)
            repository.insert_run(session, run_id=record.run_id, conversation_id=conversation.id, user_id=user_id,
                                  query=query)
            repository.touch_conversation(session, conversation.id, status="running", counted=False)
        with self._lock:
            self._live[record.run_id] = record
        return record

    def get(self, run_id: str) -> RunRecord | None:
        with self._lock:
            live = self._live.get(run_id)
        if live is not None:
            return live
        with session_scope(self.engine) as session:
            row = repository.load_run(session, run_id)
            if row is None:
                return None
            data = repository.run_to_dict(row)
            events = repository.load_events(session, run_id)
        return _record_from_row(data, events)

    def persist_event(self, run_id: str, event: dict) -> None:
        with session_scope(self.engine) as session:
            repository.append_event(session, run_id, event)

    def persist_status(self, record: RunRecord) -> None:
        terminal = record.status in TERMINAL
        with record.lock:
            fields = {"status": record.status, "started_at": record.started_at, "finished_at": record.finished_at,
                      "error": record.error, "elapsed_seconds": record.elapsed(),
                      "snapshot": jsonable(record.view.snapshot()) if terminal else None}
        with session_scope(self.engine) as session:
            repository.update_run(session, record.run_id, **fields)
            if record.status in {"completed", "failed"}:
                repository.save_reports(session, run_id=record.run_id, conversation_id=record.conversation_id,
                                        user_id=record.user_id, state=fields["snapshot"]["state"])
                status = record.view.state.get("supervisor_status") or record.view.state.get("planning_status") or record.status
                repository.touch_conversation(session, record.conversation_id, status=status, counted=True)
            elif record.status == "waiting_input":
                repository.touch_conversation(session, record.conversation_id, status="waiting_input", counted=False)
        if record.status in {"completed", "failed"}:
            with self._lock:
                self._live.pop(record.run_id, None)
            record.store = None

    def for_conversation(self, conversation_id: str) -> list[RunRecord]:
        with session_scope(self.engine) as session:
            rows = [repository.run_to_dict(r) for r in repository.runs_for_conversation(session, conversation_id)]
        return [self.get(row["run_id"]) or _record_from_row(row, []) for row in rows]

    def recover(self) -> int:
        with session_scope(self.engine) as session:
            return repository.fail_unfinished_runs(session, RESTART_MESSAGE)


class RunManager:
    """Executes graph runs on a bounded pool; each run's thread_id is its conversation_id."""

    def __init__(self, graph, store: RunStore, *, max_workers: int = 2, config_factory=None):
        self.graph, self.store = graph, store
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="invest-run")
        self._config_factory = config_factory or (lambda: {})

    def start(self, *, query: str, conversation_id: str | None, user_id: str) -> RunRecord:
        record = self.store.create(query=query.strip(), conversation_id=conversation_id, user_id=user_id)
        record.append({"type": "run_queued", "scope": "parent", "task_id": None, "category": None,
                       "payload": {"query": record.query, "conversation_id": record.conversation_id}})
        self._pool.submit(self._execute, record, {"user_query": record.query})
        return record

    def resume(self, record: RunRecord, answer: str) -> RunRecord:
        with record.lock:
            if record.status != "waiting_input":
                raise ValueError("run is not waiting for input")
            record.status = "queued"
            record.view.interrupt = None
            record.store = record.store or self.store
        record.append({"type": "clarification_answered", "scope": "parent", "task_id": None, "category": None,
                       "payload": {"answer": answer}})
        self.store.persist_status(record)
        self._pool.submit(self._execute, record, Command(resume=answer))
        return record

    def shutdown(self):
        self._pool.shutdown(wait=False, cancel_futures=True)

    def _config(self, record: RunRecord) -> dict:
        config = dict(self._config_factory())
        config["configurable"] = {**config.get("configurable", {}), "thread_id": record.conversation_id}
        return config

    def _execute(self, record: RunRecord, payload):
        with record.lock:
            record.status, record.started_at = "running", _now()
            record._started_monotonic = record._started_monotonic or time.monotonic()
            record.finished_at, record.error = None, None
        record.append({"type": "run_started", "scope": "parent", "task_id": None, "category": None,
                       "payload": {"resumed": isinstance(payload, Command)}})
        self.store.persist_status(record)
        try:
            for namespace, mode, update in self.graph.stream(payload, config=self._config(record), subgraphs=True,
                                                              stream_mode=["updates", "custom"]):
                for event in normalize(record.view, namespace, mode, update):
                    record.append(event)
            status = terminal_status(record.view)
        except Exception as exc:  # noqa: BLE001 - the run boundary must never leak exceptions into the pool.
            status = "failed"
            with record.lock:
                record.error = {"type": "execution_error", "message": "运行异常，已保留本轮可用事件，请重试。",
                                "detail": type(exc).__name__}
        with record.lock:
            record.status = status
            if status != "waiting_input":
                record.finished_at = _now()
                record._elapsed_final = time.monotonic() - record._started_monotonic
        kind = "run_waiting" if status == "waiting_input" else "run_finished"
        record.append({"type": kind, "scope": "parent", "task_id": None, "category": None,
                       "payload": {"status": status, "error": record.error, "elapsed_seconds": record.elapsed()}})
        self.store.persist_status(record)
