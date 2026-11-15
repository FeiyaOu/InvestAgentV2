"""Run records, the in-process store, and the thread-pool runner around the parent graph.

The store is in-memory for now; the API shape (ordered events with seq numbers,
replay via `after`) is what the database-backed store will keep in step 4.
"""
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

from langgraph.types import Command

from api.events import RunView, normalize, terminal_status

TERMINAL = {"completed", "failed", "waiting_input"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def jsonable(value):
    """Events may carry pydantic models or messages; degrade to strings rather than fail."""
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


@dataclass
class RunRecord:
    run_id: str
    conversation_id: str
    query: str
    status: str = "queued"
    created_at: str = field(default_factory=_now)
    started_at: str | None = None
    finished_at: str | None = None
    error: dict | None = None
    events: list[dict] = field(default_factory=list)
    view: RunView = field(default_factory=RunView)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _started_monotonic: float | None = field(default=None, repr=False)
    _elapsed_final: float = field(default=0.0, repr=False)

    def append(self, event: dict) -> dict:
        with self.lock:
            event = {"seq": len(self.events) + 1, "run_id": self.run_id, **jsonable(event)}
            self.events.append(event)
            return event

    def events_after(self, seq: int) -> list[dict]:
        with self.lock:
            return self.events[seq:]

    def elapsed(self) -> float | None:
        if self._started_monotonic is None:
            return None
        if self.finished_at:
            return round(self._elapsed_final, 1)
        return round(time.monotonic() - self._started_monotonic, 1)

    def snapshot(self) -> dict:
        with self.lock:
            return jsonable({"run_id": self.run_id, "conversation_id": self.conversation_id, "query": self.query,
                             "status": self.status, "created_at": self.created_at, "started_at": self.started_at,
                             "finished_at": self.finished_at, "error": self.error, "elapsed_seconds": self.elapsed(),
                             "event_count": len(self.events), **self.view.snapshot()})


class RunStore:
    def __init__(self):
        self._runs: dict[str, RunRecord] = {}
        self._lock = threading.Lock()

    def create(self, query: str, conversation_id: str) -> RunRecord:
        record = RunRecord(run_id="run_" + uuid4().hex, conversation_id=conversation_id, query=query)
        with self._lock:
            self._runs[record.run_id] = record
        return record

    def get(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def for_conversation(self, conversation_id: str) -> list[RunRecord]:
        with self._lock:
            return sorted((r for r in self._runs.values() if r.conversation_id == conversation_id),
                          key=lambda r: r.created_at)


class RunManager:
    """Executes graph runs on a bounded pool; each run's thread_id is its conversation_id."""

    def __init__(self, graph, store: RunStore, *, max_workers: int = 2, config_factory=None):
        self.graph, self.store = graph, store
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="invest-run")
        self._config_factory = config_factory or (lambda: {})

    def start(self, query: str, conversation_id: str | None = None) -> RunRecord:
        record = self.store.create(query.strip(), conversation_id or "conv_" + uuid4().hex)
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
        record.append({"type": "clarification_answered", "scope": "parent", "task_id": None, "category": None,
                       "payload": {"answer": answer}})
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
