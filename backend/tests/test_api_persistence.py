"""Accounts, ownership, and durability of runs/reports across process restarts."""
import json

from fastapi.testclient import TestClient

from api.main import create_app
from tests.conftest import make_valid_report
from tests.test_api_events import PLAN
from tests.test_api_runs import AuthedClient, ScriptedGraph, script, test_settings, wait_terminal


def report_script(report=None, errors=None, status="completed"):
    report = report or make_valid_report()
    plan = {**PLAN, "tasks": [{"task_id": "rep", "category": "report", "question": "生成新能源行业报告", "depends_on": []}]}
    record = {**plan["tasks"][0], "status": status, "error": None,
              "result": {"final_report": json.dumps(report, ensure_ascii=False), "validation_errors": errors or []}}
    return [((), "updates", {"initialize": {"user_query": "生成新能源行业报告"}}),
            ((), "updates", {"planner": {"plan": plan, "planning_status": "ready"}}),
            (("supervisor:x",), "custom", {"event": "task_started", "task_id": "rep", "category": "report"}),
            (("supervisor:x", "report:y"), "updates", {"perception": {"perception_data": {"a": 1}}}),
            ((), "updates", {"supervisor": {"task_results": {"rep": record}, "supervisor_status": status}}),
            ((), "updates", {"composer": {"final_response": "报告已生成，请到报告中心查看。", "composition_status": "completed"}})]


def open_client(tmp_path, *scripts):
    settings = test_settings(tmp_path)
    client = TestClient(create_app(graph=ScriptedGraph(*scripts), settings=settings, max_workers=1))
    client.__enter__()
    return client


def test_register_login_me_and_duplicate_email(tmp_path):
    client = open_client(tmp_path)
    try:
        created = client.post("/api/auth/register", json={"email": "Who@Example.com", "password": "password123"})
        assert created.status_code == 201 and created.json()["user"]["email"] == "who@example.com"
        assert client.post("/api/auth/register", json={"email": "who@example.com", "password": "password123"}).status_code == 409
        assert client.post("/api/auth/register", json={"email": "not-an-email", "password": "password123"}).status_code == 422
        assert client.post("/api/auth/register", json={"email": "x@example.com", "password": "short"}).status_code == 422
        assert client.post("/api/auth/login", json={"email": "who@example.com", "password": "wrong"}).status_code == 401
        token = client.post("/api/auth/login", json={"email": "who@example.com", "password": "password123"}).json()["access_token"]
        me = client.get("/api/auth/me", headers={"authorization": f"Bearer {token}"})
        assert me.status_code == 200 and me.json()["display_name"] == "Who"
        assert client.get("/api/auth/me", headers={"authorization": "Bearer nonsense"}).status_code == 401
    finally:
        client.__exit__(None, None, None)


def test_runs_conversations_and_reports_are_scoped_to_owner(tmp_path):
    client = open_client(tmp_path, script(), script())
    try:
        alice, bob = AuthedClient(client, "alice@example.com"), AuthedClient(client, "bob@example.com")
        run_id = alice.post("/api/runs", json={"query": "查茅台价格", "conversation_id": "shared-id"}).json()["run_id"]
        wait_terminal(alice, run_id)
        assert bob.get(f"/api/runs/{run_id}").status_code == 404
        assert bob.get(f"/api/runs/{run_id}/events/list").status_code == 404
        assert bob.get("/api/conversations/shared-id").status_code == 404
        assert bob.post("/api/runs", json={"query": "蹭对话", "conversation_id": "shared-id"}).status_code == 403
        assert bob.get("/api/conversations").json() == []
        assert bob.get("/api/runs").json() == []
        assert [r["run_id"] for r in alice.get("/api/runs").json()] == [run_id]
    finally:
        client.__exit__(None, None, None)


def test_run_events_and_reports_survive_restart(tmp_path):
    client = open_client(tmp_path, report_script())
    try:
        user = AuthedClient(client, "alice@example.com")
        run_id = user.post("/api/runs", json={"query": "生成新能源行业报告", "conversation_id": "c1"}).json()["run_id"]
        done = wait_terminal(user, run_id)
        assert done["status"] == "completed"
        events_before = user.get(f"/api/runs/{run_id}/events/list").json()
        reports = user.get("/api/reports").json()
        assert len(reports) == 1 and reports[0]["title"] == "新能源行业" and reports[0]["draft"] is False
        report_id = reports[0]["id"]
        token = user.token
    finally:
        client.__exit__(None, None, None)

    # A fresh process over the same database: nothing is in memory any more.
    client = open_client(tmp_path)
    try:
        headers = {"authorization": f"Bearer {token}"}
        snapshot = client.get(f"/api/runs/{run_id}", headers=headers).json()
        assert snapshot["status"] == "completed"
        assert snapshot["state"]["final_response"] == "报告已生成，请到报告中心查看。"
        assert snapshot["report_progress"] == {"rep": {"perception_data": {"a": 1}}}
        assert client.get(f"/api/runs/{run_id}/events/list", headers=headers).json() == events_before
        replay = client.get(f"/api/runs/{run_id}/events/list", headers=headers, params={"after": 3}).json()
        assert replay[0]["seq"] == 4
        detail = client.get(f"/api/reports/{report_id}", headers=headers).json()
        assert detail["report"]["overall_rating"] == "buy" and detail["question"] == "生成新能源行业报告"
        markdown = client.get(f"/api/reports/{report_id}/download", headers=headers)
        assert markdown.status_code == 200 and markdown.headers["content-type"].startswith("text/markdown")
        assert "# 新能源行业" in markdown.text and "rep.md" in markdown.headers["content-disposition"]
        html = client.get(f"/api/reports/{report_id}/download", headers=headers, params={"format": "html"})
        assert html.text.startswith("<!doctype html>") and "<h1>新能源行业</h1>" in html.text
        assert client.get(f"/api/reports/{report_id}/download", headers=headers, params={"format": "pdf"}).status_code == 422
        conversations = client.get("/api/conversations", headers=headers).json()
        assert conversations[0]["conversation_id"] == "c1" and conversations[0]["turn_count"] == 1
        assert conversations[0]["last_status"] == "completed"
    finally:
        client.__exit__(None, None, None)


def test_partial_report_is_saved_as_draft_and_download_is_labelled(tmp_path):
    thin = make_valid_report()
    thin["sources"] = thin["sources"][:2]  # Violates C5; validate_report is the single source of truth, not stored errors.
    client = open_client(tmp_path, report_script(report=thin, status="partial"))
    try:
        user = AuthedClient(client, "alice@example.com")
        run_id = user.post("/api/runs", json={"query": "生成报告"}).json()["run_id"]
        wait_terminal(user, run_id)
        [report] = user.get("/api/reports").json()
        assert report["draft"] is True and report["status"] == "partial"
        assert report["validation_errors"][0]["type"] == "insufficient_sources"
        download = user.get(f"/api/reports/{report['id']}/download")
        assert "rep-draft.md" in download.headers["content-disposition"] and "草稿" in download.text
    finally:
        client.__exit__(None, None, None)


def test_unfinished_runs_are_failed_on_restart(tmp_path):
    settings = test_settings(tmp_path)
    graph = ScriptedGraph()
    client = TestClient(create_app(graph=graph, settings=settings, max_workers=1))
    client.__enter__()
    user = AuthedClient(client, "alice@example.com")
    # Seed an unfinished run without launching a worker: observing a terminal HTTP
    # snapshot does not guarantee the worker has committed its final DB write.
    record = client.app.state.run_manager.store.create(query="x", conversation_id=None, user_id=user.user["id"])
    run_id = record.run_id
    event = record.append({"type": "run_started", "scope": "parent", "task_id": None,
                           "category": None, "payload": {"resumed": False}})
    from sqlmodel import Session

    from api.models import Run
    with Session(client.app.state.engine) as session:
        row = session.get(Run, run_id)
        row.status, row.finished_at = "running", None
        session.add(row)
        session.commit()
    client.__exit__(None, None, None)

    client = TestClient(create_app(graph=ScriptedGraph(), settings=settings, max_workers=1))
    client.__enter__()
    try:
        snapshot = client.get(f"/api/runs/{run_id}", headers={"authorization": f"Bearer {user.token}"}).json()
        assert snapshot["status"] == "failed"
        assert snapshot["error"]["type"] == "service_restarted"
        assert snapshot["finished_at"] is not None
        events = client.get(f"/api/runs/{run_id}/events/list", headers={"authorization": f"Bearer {user.token}"}).json()
        assert events == [event]
    finally:
        client.__exit__(None, None, None)
