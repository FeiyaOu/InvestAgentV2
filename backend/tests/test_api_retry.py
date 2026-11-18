from fastapi.testclient import TestClient

from api.main import create_app
from tests.test_api_events import script
from tests.test_api_runs import AuthedClient, ScriptedGraph, wait_terminal
from tests.test_api_runs import test_settings as settings_for


def test_retry_same_run_preserves_archive_and_plan_and_owner(tmp_path):
    graph = ScriptedGraph(script(), script())
    settings = settings_for(tmp_path)
    with TestClient(create_app(graph=graph, settings=settings)) as raw:
        alice, bob = AuthedClient(raw), AuthedClient(raw, 'bob@example.com')
        created = alice.post('/api/runs', json={'query': '查行情'}).json()
        original = wait_terminal(alice, created['run_id'])
        assert bob.post(f"/api/runs/{created['run_id']}/retry").status_code == 404
        response = alice.post(f"/api/runs/{created['run_id']}/retry")
        assert response.status_code == 202
        latest = wait_terminal(alice, created['run_id'])
        assert latest['run_id'] == original['run_id']
        assert len(alice.get('/api/runs').json()) == 1
        assert graph.calls[1][0]['retry_plan'] == original['state']['plan']
        assert latest['state']['retry_history'][0]['state']['final_response'] == original['state']['final_response']
        assert latest['event_count'] > original['event_count']
        assert alice.get('/api/conversations').json()[0]['turn_count'] == 1
        token = alice.token
    with TestClient(create_app(graph=ScriptedGraph(), settings=settings)) as raw:
        restored = raw.get(f"/api/runs/{created['run_id']}", headers={'authorization': f'Bearer {token}'}).json()
        assert len(restored['state']['retry_history']) == 1


def test_retry_without_saved_plan_is_rejected(tmp_path):
    graph = ScriptedGraph([((), 'updates', {'composer': {'final_response': '无法规划'}})])
    with TestClient(create_app(graph=graph, settings=settings_for(tmp_path))) as raw:
        user = AuthedClient(raw)
        ident = user.post('/api/runs', json={'query': '你好'}).json()['run_id']
        wait_terminal(user, ident)
        assert user.post(f'/api/runs/{ident}/retry').status_code == 409


def test_retry_duplicate_is_rejected_while_running(tmp_path):
    import threading
    entered, release = threading.Event(), threading.Event()

    class BlockSecond(ScriptedGraph):
        def stream(self, *args, **kwargs):
            if len(self.calls) == 1:
                entered.set()
                assert release.wait(5)
            yield from super().stream(*args, **kwargs)

    graph = BlockSecond(script(), script())
    with TestClient(create_app(graph=graph, settings=settings_for(tmp_path))) as raw:
        user = AuthedClient(raw)
        ident = user.post('/api/runs', json={'query': '查行情'}).json()['run_id']
        wait_terminal(user, ident)
        try:
            assert user.post(f'/api/runs/{ident}/retry').status_code == 202
            assert entered.wait(3)
            assert user.post(f'/api/runs/{ident}/retry').status_code == 409
        finally:
            release.set()
        assert wait_terminal(user, ident)['status'] == 'completed'


def test_successful_retry_updates_report_without_duplicate_library_entry(tmp_path):
    from tests.conftest import make_valid_report
    from tests.test_api_persistence import report_script
    original = report_script()
    original[1][2]['planner']['plan']['tasks'].append(
        {'task_id': 'm', 'category': 'market_data', 'question': '查数据', 'depends_on': []})
    revised = make_valid_report()
    revised['research_topic'] = '更新后的行业报告'
    retry_script = report_script(report=revised)
    with TestClient(create_app(graph=ScriptedGraph(original, retry_script), settings=settings_for(tmp_path))) as raw:
        user = AuthedClient(raw)
        ident = user.post('/api/runs', json={'query': '生成报告'}).json()['run_id']
        wait_terminal(user, ident)
        before = user.get('/api/reports').json()[0]
        assert user.post(f'/api/runs/{ident}/retry').status_code == 202
        wait_terminal(user, ident)
        [after] = user.get('/api/reports').json()
        assert before['id'] == after['id']
        assert after['title'] == '更新后的行业报告'
