"""Deletion is owned, durable, and refuses to race live research."""
from unittest.mock import Mock

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from api.main import create_app
from api.models import Report, Run, RunEventRow
from tests.test_api_persistence import report_script
from tests.test_api_runs import AuthedClient, ScriptedGraph, interrupt_script, wait_terminal
from tests.test_api_runs import test_settings as settings_for


def test_report_delete_preserves_research_and_survives_restart(tmp_path):
    settings = settings_for(tmp_path)
    with TestClient(create_app(graph=ScriptedGraph(report_script()), settings=settings)) as raw:
        alice, bob = AuthedClient(raw), AuthedClient(raw, 'bob@example.com')
        run_id = alice.post('/api/runs', json={'query': '生成报告'}).json()['run_id']
        wait_terminal(alice, run_id)
        raw.app.state.run_manager._pool.shutdown(wait=True)
        report_id = alice.get('/api/reports').json()[0]['id']
        assert bob.delete(f'/api/reports/{report_id}').status_code == 404
        assert alice.delete(f'/api/reports/{report_id}').status_code == 204
        assert alice.get('/api/reports').json() == []
        assert alice.get(f'/api/reports/{report_id}/download').status_code == 404
        assert alice.get(f'/api/runs/{run_id}').status_code == 200
        token = alice.token
    with TestClient(create_app(graph=ScriptedGraph(), settings=settings)) as raw:
        assert raw.get('/api/reports', headers={'authorization': f'Bearer {token}'}).json() == []


def test_run_delete_removes_events_and_reports_and_rejects_live_runs(tmp_path):
    with TestClient(create_app(graph=ScriptedGraph(report_script(), interrupt_script()), settings=settings_for(tmp_path), max_workers=1)) as raw:
        alice, bob = AuthedClient(raw), AuthedClient(raw, 'bob@example.com')
        created = alice.post('/api/runs', json={'query': '生成报告'}).json()
        run_id = created['run_id']
        wait_terminal(alice, run_id)
        # Wait for the worker's final DB write rather than just its in-memory status.
        raw.app.state.run_manager._pool.submit(lambda: None).result(timeout=5)
        assert bob.delete(f'/api/runs/{run_id}').status_code == 404
        assert alice.delete(f'/api/runs/{run_id}').status_code == 204
        assert alice.get(f'/api/runs/{run_id}').status_code == 404
        assert alice.get(f'/api/runs/{run_id}/events/list').status_code == 404
        assert alice.get('/api/reports').json() == []
        with Session(raw.app.state.engine) as db:
            assert db.exec(select(RunEventRow).where(RunEventRow.run_id == run_id)).all() == []
            assert db.exec(select(Report).where(Report.run_id == run_id)).all() == []
        waiting = alice.post('/api/runs', json={'query': '哪只股票'}).json()['run_id']
        assert wait_terminal(alice, waiting)['status'] == 'waiting_input'
        assert alice.delete(f'/api/runs/{waiting}').status_code == 409
        cid = alice.get(f'/api/runs/{waiting}').json()['conversation_id']
        assert alice.delete(f'/api/conversations/{cid}').status_code == 409
        alice.post(f'/api/runs/{waiting}/cancel')
        assert alice.delete(f'/api/runs/{waiting}').status_code == 204


def test_conversation_delete_clears_checkpoint_and_all_owned_children(tmp_path):
    graph = ScriptedGraph(report_script())
    graph.checkpointer = Mock()
    with TestClient(create_app(graph=graph, settings=settings_for(tmp_path))) as raw:
        alice, bob = AuthedClient(raw), AuthedClient(raw, 'bob@example.com')
        created = alice.post('/api/runs', json={'query': '生成报告'}).json()
        wait_terminal(alice, created['run_id'])
        raw.app.state.run_manager._pool.shutdown(wait=True)
        cid = created['conversation_id']
        assert bob.delete(f'/api/conversations/{cid}').status_code == 404
        graph.checkpointer.delete_thread.assert_not_called()
        assert alice.delete(f'/api/conversations/{cid}').status_code == 204
        graph.checkpointer.delete_thread.assert_called_once_with(cid)
        assert alice.get('/api/conversations').json() == []
        assert alice.get('/api/runs').json() == []
        assert alice.get('/api/reports').json() == []
        with Session(raw.app.state.engine) as db:
            assert db.exec(select(Run)).all() == []


def test_deleting_a_conversation_removes_real_sqlite_checkpoints(tmp_path):
    from langgraph.checkpoint.sqlite import SqliteSaver
    from langgraph.graph import END, START, StateGraph
    from typing_extensions import TypedDict

    class State(TypedDict):
        user_query: str
        final_response: str

    settings = settings_for(tmp_path)
    with SqliteSaver.from_conn_string(str(tmp_path / 'api.sqlite')) as saver:
        builder = StateGraph(State)
        builder.add_node('answer', lambda state: {'final_response': 'done'})
        builder.add_edge(START, 'answer')
        builder.add_edge('answer', END)
        with TestClient(create_app(graph=builder.compile(checkpointer=saver), settings=settings)) as raw:
            alice = AuthedClient(raw)
            created = alice.post('/api/runs', json={'query': 'x'}).json()
            wait_terminal(alice, created['run_id'])
            raw.app.state.run_manager._pool.shutdown(wait=True)
            config = {'configurable': {'thread_id': created['conversation_id']}}
            assert saver.get_tuple(config) is not None
            assert alice.delete(f"/api/conversations/{created['conversation_id']}").status_code == 204
            assert saver.get_tuple(config) is None


def test_guest_can_delete_only_its_own_temporary_research(tmp_path):
    from tests.test_guest_sessions import GuestClient

    with TestClient(create_app(graph=ScriptedGraph(report_script()), settings=settings_for(tmp_path))) as raw:
        alice, bob = GuestClient(raw), GuestClient(raw)
        created = alice.post('/api/runs', json={'query': '生成报告'}).json()
        wait_terminal(alice, created['run_id'])
        raw.app.state.run_manager._pool.shutdown(wait=True)
        path = f"/api/runs/{created['run_id']}"
        assert raw.delete(path, headers=bob.headers).status_code == 404
        assert raw.delete(path, headers=alice.headers).status_code == 204
        assert alice.get('/api/runs').json() == []
        assert alice.get('/api/reports').json() == []
        assert alice.get(f"/api/conversations/{created['conversation_id']}").json()['turns'] == []
