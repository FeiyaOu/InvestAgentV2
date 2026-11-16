"""Guest workspaces are isolated, ephemeral, and never enter the account database."""
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from api.main import create_app
from api.models import Run, User
from tests.test_api_persistence import report_script
from tests.test_api_runs import AuthedClient, ScriptedGraph, script, wait_terminal
from tests.test_api_runs import test_settings as settings_for


class GuestClient:
    def __init__(self, raw):
        self.raw = raw
        response = raw.post('/api/auth/guest')
        assert response.status_code == 201
        self.body = response.json()
        self.token = self.body['access_token']
        self.headers = {'authorization': f'Bearer {self.token}'}

    def get(self, path):
        return self.raw.get(path, headers=self.headers)

    def post(self, path, **kwargs):
        return self.raw.post(path, headers=self.headers, **kwargs)


def test_guest_reports_are_temporary_and_never_saved_as_account_data(tmp_path):
    settings = settings_for(tmp_path)
    with TestClient(create_app(graph=ScriptedGraph(report_script()), settings=settings)) as raw:
        first, second = GuestClient(raw), GuestClient(raw)
        assert first.body['user']['is_guest'] is True
        run_id = first.post('/api/runs', json={'query': '生成报告'}).json()['run_id']
        assert wait_terminal(first, run_id)['status'] == 'completed'
        reports = first.get('/api/reports').json()
        assert len(reports) == 1
        assert first.get(f"/api/reports/{reports[0]['id']}/download").status_code == 200
        assert second.get('/api/runs').json() == []
        assert second.get(f'/api/runs/{run_id}').status_code == 404
        with Session(raw.app.state.engine) as db:
            assert db.exec(select(User)).all() == []
            assert db.exec(select(Run)).all() == []
        assert raw.post('/api/auth/guest/end', json={'token': first.token}).status_code == 204
        assert first.get('/api/auth/me').status_code == 401
        assert first.body['user']['id'] not in raw.app.state.guest_sessions.sessions
        assert second.get('/api/auth/me').status_code == 200
    with TestClient(create_app(graph=ScriptedGraph(), settings=settings)) as raw:
        assert raw.get('/api/runs', headers=second.headers).status_code == 401


def test_registered_history_survives_guest_end_and_process_restart(tmp_path):
    settings = settings_for(tmp_path)
    with TestClient(create_app(graph=ScriptedGraph(script()), settings=settings)) as raw:
        account = AuthedClient(raw)
        run_id = account.post('/api/runs', json={'query': '查询茅台'}).json()['run_id']
        wait_terminal(account, run_id)
        guest = GuestClient(raw)
        assert guest.get(f'/api/runs/{run_id}').status_code == 404
        raw.post('/api/auth/guest/end', json={'token': guest.token})
        assert raw.post('/api/auth/guest/end', json={'token': account.token}).status_code == 403
        token = account.token
        raw.app.state.run_manager._pool.shutdown(wait=True)
    with TestClient(create_app(graph=ScriptedGraph(), settings=settings)) as raw:
        assert raw.get(f'/api/runs/{run_id}', headers={'authorization': f'Bearer {token}'}).status_code == 200


def test_idle_guests_expire_and_registration_can_still_be_closed(tmp_path):
    from dataclasses import replace

    settings = replace(settings_for(tmp_path), allow_registration=False)
    with TestClient(create_app(graph=ScriptedGraph(), settings=settings)) as raw:
        guest = GuestClient(raw)
        workspace = raw.app.state.guest_sessions.sessions[guest.body['user']['id']]
        workspace.last_seen -= 3600
        raw.app.state.guest_sessions.reap()
        assert guest.get('/api/auth/me').status_code == 401
        assert workspace.disposed
        assert raw.post('/api/auth/register', json={'email': 'a@example.com', 'password': 'password123'}).status_code == 403


def test_closing_a_busy_guest_revokes_access_and_cleans_up_after_the_request_returns(tmp_path):
    import threading

    entered, release = threading.Event(), threading.Event()

    class BlockingGraph:
        def stream(self, *args, **kwargs):
            entered.set()
            assert release.wait(10)
            yield (), 'updates', {'initialize': {'user_query': 'temporary'}}

    with TestClient(create_app(graph=BlockingGraph(), settings=settings_for(tmp_path))) as raw:
        guest = GuestClient(raw)
        workspace = raw.app.state.guest_sessions.sessions[guest.body['user']['id']]
        try:
            run_id = guest.post('/api/runs', json={'query': 'temporary'}).json()['run_id']
            assert entered.wait(5)
            assert raw.post('/api/auth/guest/end', json={'token': guest.token}).status_code == 204
            assert guest.get(f'/api/runs/{run_id}').status_code == 401
            assert not workspace.disposed
        finally:
            release.set()
            raw.app.state.run_manager._pool.shutdown(wait=True)
        assert workspace.disposed
        assert workspace.manager.graph is None
