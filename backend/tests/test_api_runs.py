"""HTTP layer against a scripted graph: auth, create, poll, stream, resume, fail, read conversation."""
import json
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from langgraph.types import Command

from api.main import create_app
from api.runs import TERMINAL
from api.settings import Settings
from tests.test_api_events import PLAN, RESULT, script

INTERRUPT = {"type": "clarification", "questions": ["哪家公司？"], "round": 1, "max_rounds": 2}


class ScriptedGraph:
    """Each stream() call consumes the next script; a script may be an exception to raise mid-stream."""

    def __init__(self, *scripts, turns=None):
        self.scripts, self.calls, self.turns = list(scripts), [], turns or []

    def stream(self, payload, config=None, **kwargs):
        self.calls.append((payload, config, kwargs))
        items = self.scripts.pop(0)
        for item in items:
            if isinstance(item, Exception):
                raise item
            yield item

    def get_state(self, config):
        return SimpleNamespace(values={"turns": self.turns} if self.turns else {})


def interrupt_script():
    return [((), "updates", {"initialize": {"user_query": "它多少钱？"}}),
            ((), "updates", {"planner": {"plan": {"status": "needs_clarification", "tasks": [],
                                                  "clarification_questions": ["哪家公司？"]},
                                         "planning_status": "needs_clarification"}}),
            ((), "updates", {"__interrupt__": (SimpleNamespace(value=INTERRUPT),)})]


def resume_script():
    return [((), "updates", {"clarify": {"user_query": "它多少钱？\n\n补充说明：茅台", "clarification_rounds": 1}})] + script()[1:]


def test_settings(tmp_path):
    return Settings(database_url=f"sqlite:///{tmp_path / 'api.sqlite'}", jwt_secret="test-secret-with-at-least-32-bytes-of-entropy", max_concurrent_runs=1,
                    cors_origins=(), sse_poll_seconds=0.01)


class AuthedClient:
    """TestClient wrapper that registers a user and sends the bearer token on every call."""

    def __init__(self, client: TestClient, email="a@example.com"):
        self.client = client
        body = client.post("/api/auth/register", json={"email": email, "password": "password123", "display_name": "研"}).json()
        self.token = body["access_token"]
        self.user = body["user"]
        self.headers = {"authorization": f"Bearer {self.token}"}

    def __getattr__(self, name):
        method = getattr(self.client, name)

        def call(*args, **kwargs):
            kwargs["headers"] = {**self.headers, **kwargs.get("headers", {})}
            return method(*args, **kwargs)
        return call


@pytest.fixture
def make_client(tmp_path):
    clients = []

    def factory(*scripts, turns=None, settings=None, authed=True):
        graph = ScriptedGraph(*scripts, turns=turns)
        client = TestClient(create_app(graph=graph, settings=settings or test_settings(tmp_path), max_workers=1))
        client.__enter__()
        clients.append(client)
        return (AuthedClient(client) if authed else client), graph
    yield factory
    for client in clients:
        client.__exit__(None, None, None)


def wait_terminal(client, run_id, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        snapshot = client.get(f"/api/runs/{run_id}").json()
        if snapshot["status"] in TERMINAL:
            return snapshot
        time.sleep(0.02)
    raise AssertionError("run did not finish")


def parse_sse(text):
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append({"id": int(lines["id"]), "event": lines["event"], "data": json.loads(lines["data"])})
    return events


def test_health_is_public(make_client):
    client, _ = make_client(authed=False)
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.post("/api/runs", json={"query": "x"}).status_code == 401


def test_create_run_executes_graph_on_thread_and_exposes_snapshot(make_client):
    client, graph = make_client(script())
    created = client.post("/api/runs", json={"query": " 查茅台价格 "})
    assert created.status_code == 202
    body = created.json()
    assert body["status"] in {"queued", "running", "completed"} and body["conversation_id"].startswith("conv_")
    snapshot = wait_terminal(client, body["run_id"])
    assert snapshot["status"] == "completed"
    assert snapshot["state"]["final_response"] == "价格100元。"
    assert snapshot["state"]["task_results"] == RESULT
    assert snapshot["active_task"] == "m" and snapshot["elapsed_seconds"] is not None
    payload, config, kwargs = graph.calls[0]
    assert payload == {"user_query": "查茅台价格"}
    assert config["configurable"]["thread_id"] == body["conversation_id"]
    assert kwargs == {"subgraphs": True, "stream_mode": ["updates", "custom"]}


def test_event_list_is_ordered_and_replayable(make_client):
    client, _ = make_client(script())
    run_id = client.post("/api/runs", json={"query": "查茅台价格", "conversation_id": "conv-1"}).json()["run_id"]
    wait_terminal(client, run_id)
    events = client.get(f"/api/runs/{run_id}/events/list").json()
    assert [e["seq"] for e in events] == list(range(1, len(events) + 1))
    kinds = [e["type"] for e in events]
    assert kinds[:2] == ["run_queued", "run_started"] and kinds[-1] == "run_finished"
    assert {"planner_attempt", "task_started", "node_update"} <= set(kinds)
    assert events[-1]["payload"]["status"] == "completed"
    later = client.get(f"/api/runs/{run_id}/events/list", params={"after": len(events) - 2}).json()
    assert [e["seq"] for e in later] == [len(events) - 1, len(events)]


def test_sse_stream_replays_then_follows_until_finished_with_query_token(make_client):
    client, _ = make_client(script())
    run_id = client.post("/api/runs", json={"query": "查茅台价格"}).json()["run_id"]
    raw = client.client  # EventSource cannot send headers; the token travels as a query parameter.
    assert raw.get(f"/api/runs/{run_id}/events").status_code == 401
    with raw.stream("GET", f"/api/runs/{run_id}/events", params={"token": client.token}) as response:
        assert response.headers["content-type"].startswith("text/event-stream")
        events = parse_sse("".join(response.iter_text()))
    assert events[0]["event"] == "run_queued" and events[-1]["event"] == "run_finished"
    assert [e["id"] for e in events] == list(range(1, len(events) + 1))
    with raw.stream("GET", f"/api/runs/{run_id}/events", params={"token": client.token, "after": events[-1]["id"] - 1}) as response:
        tail = parse_sse("".join(response.iter_text()))
    assert [e["event"] for e in tail] == ["run_finished"]


def test_clarification_waits_then_resume_continues_same_thread(make_client):
    client, graph = make_client(interrupt_script(), resume_script())
    run_id = client.post("/api/runs", json={"query": "它多少钱？", "conversation_id": "conv-2"}).json()["run_id"]
    waiting = wait_terminal(client, run_id)
    assert waiting["status"] == "waiting_input" and waiting["interrupt"] == INTERRUPT
    assert waiting["finished_at"] is None
    events = client.get(f"/api/runs/{run_id}/events/list").json()
    assert [e["type"] for e in events][-2:] == ["clarification_required", "run_waiting"]
    cursor = events[-1]["seq"]

    resumed = client.post(f"/api/runs/{run_id}/resume", json={"answer": "茅台"})
    assert resumed.status_code == 202
    done = wait_terminal(client, run_id)
    assert done["status"] == "completed" and done["interrupt"] is None
    assert done["state"]["final_response"] == "价格100元。"
    payload, config, _ = graph.calls[1]
    assert isinstance(payload, Command) and payload.resume == "茅台"
    assert config["configurable"]["thread_id"] == "conv-2"
    tail = client.get(f"/api/runs/{run_id}/events/list", params={"after": cursor}).json()
    assert [e["type"] for e in tail][:2] == ["clarification_answered", "run_started"]
    assert tail[1]["payload"]["resumed"] is True and tail[-1]["type"] == "run_finished"
    assert client.post(f"/api/runs/{run_id}/resume", json={"answer": "再来"}).status_code == 409


def test_graph_exception_marks_run_failed_without_leaking_detail(make_client):
    client, _ = make_client([((), "updates", {"initialize": {"user_query": "x"}}), RuntimeError("provider blew up")])
    run_id = client.post("/api/runs", json={"query": "x"}).json()["run_id"]
    snapshot = wait_terminal(client, run_id)
    assert snapshot["status"] == "failed"
    assert snapshot["error"]["type"] == "execution_error" and "blew up" not in json.dumps(snapshot, ensure_ascii=False)
    events = client.get(f"/api/runs/{run_id}/events/list").json()
    assert events[-1]["type"] == "run_finished" and events[-1]["payload"]["status"] == "failed"


def test_validation_and_not_found(make_client):
    client, _ = make_client()
    assert client.post("/api/runs", json={"query": "  "}).status_code == 422
    assert client.post("/api/runs", json={"query": "x", "conversation_id": "bad id!"}).status_code == 422
    assert client.post("/api/runs", json={"query": "x", "extra": 1}).status_code == 422
    assert client.get("/api/runs/run_missing").status_code == 404
    assert client.get("/api/runs/run_missing/events").status_code == 404
    assert client.post("/api/runs/run_missing/resume", json={"answer": "a"}).status_code == 404
    assert client.get("/api/conversations/none").status_code == 404


def test_conversation_merges_checkpoint_turns_and_known_runs(make_client):
    turns = [{"query": "查茅台价格", "response_preview": "价格100元。", "status": "completed",
              "clarifications": [], "completed_at": "2026-11-15T00:00:00+00:00"}]
    client, _ = make_client(script(), turns=turns)
    run_id = client.post("/api/runs", json={"query": "查茅台价格", "conversation_id": "conv-3"}).json()["run_id"]
    wait_terminal(client, run_id)
    body = client.get("/api/conversations/conv-3").json()
    assert body["conversation_id"] == "conv-3" and body["title"] == "查茅台价格" and body["turn_count"] == 1
    assert body["turns"][0]["query"] == "查茅台价格"
    assert [r["run_id"] for r in body["runs"]] == [run_id]
    assert body["runs"][0]["state"]["plan"] == PLAN
    listed = client.get("/api/conversations").json()
    assert [c["conversation_id"] for c in listed] == ["conv-3"] and listed[0]["run_count"] == 1
