"""Explicit cancellation stops future work and survives process restarts."""
import threading
from unittest.mock import Mock

from fastapi.testclient import TestClient
from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from api.main import create_app
from tests.test_api_runs import AuthedClient, ScriptedGraph, interrupt_script, wait_terminal
from tests.test_api_runs import test_settings as settings_for


def test_cancel_waiting_is_owned_idempotent_and_survives_restart(tmp_path):
    settings = settings_for(tmp_path)
    with TestClient(create_app(graph=ScriptedGraph(interrupt_script()), settings=settings)) as raw:
        alice = AuthedClient(raw)
        run_id = alice.post('/api/runs', json={'query': '哪只股票'}).json()['run_id']
        assert wait_terminal(alice, run_id)['status'] == 'waiting_input'
        bob = AuthedClient(raw, 'bob@example.com')
        assert bob.post(f'/api/runs/{run_id}/cancel').status_code == 404
        stopped = alice.post(f'/api/runs/{run_id}/cancel')
        assert stopped.status_code == 202
        assert stopped.json()['status'] == 'cancelled'
        assert stopped.json()['interrupt'] is None
        assert alice.post(f'/api/runs/{run_id}/cancel').json()['status'] == 'cancelled'
        assert alice.post(f'/api/runs/{run_id}/resume', json={'answer': '茅台'}).status_code == 409
        assert '"status": "cancelled"' in alice.get(f'/api/runs/{run_id}/events').text
        token = alice.token
    with TestClient(create_app(graph=ScriptedGraph(), settings=settings)) as raw:
        headers = {'authorization': f'Bearer {token}'}
        assert raw.get(f'/api/runs/{run_id}', headers=headers).json()['status'] == 'cancelled'
        events = raw.get(f'/api/runs/{run_id}/events/list', headers=headers).json()
        assert events[-1]['payload']['status'] == 'cancelled'


def test_cancel_running_blocks_next_node_and_queued_run_never_starts(tmp_path):
    entered, release = threading.Event(), threading.Event()
    next_call = Mock()

    class State(TypedDict):
        user_query: str

    def in_flight(state):
        entered.set()
        assert release.wait(10)
        # Even a second call inside the current node must be blocked, without
        # being swallowed by the provider-error fallback used in specialists.
        try:
            RunnableLambda(lambda _: next_call('api')).invoke(state)
        except Exception:
            next_call('fallback')
        return {}

    def next_node(state):
        next_call()
        return {}

    builder = StateGraph(State)
    builder.add_node('in_flight', in_flight)
    builder.add_node('next', next_node)
    builder.add_edge(START, 'in_flight')
    builder.add_edge('in_flight', 'next')
    builder.add_edge('next', END)
    with TestClient(create_app(graph=builder.compile(), settings=settings_for(tmp_path), max_workers=1)) as raw:
        user = AuthedClient(raw)
        try:
            first = user.post('/api/runs', json={'query': 'first'}).json()['run_id']
            assert entered.wait(5)
            queued = user.post('/api/runs', json={'query': 'queued'}).json()['run_id']
            assert user.post(f'/api/runs/{queued}/cancel').json()['status'] == 'cancelled'
            assert user.post(f'/api/runs/{first}/cancel').json()['status'] == 'cancelling'
            release.set()
            assert wait_terminal(user, first)['status'] == 'cancelled'
            assert user.get(f'/api/runs/{queued}').json()['started_at'] is None
            next_call.assert_not_called()
        finally:
            release.set()
            raw.app.state.run_manager._pool.shutdown(wait=True)


def test_cancellation_guard_blocks_a_model_call_even_inside_error_fallback():
    import pytest
    from langchain_core.language_models.fake_chat_models import FakeListChatModel

    from api.cancellation import CancellationGuard, RunCancelled

    stopped = threading.Event()
    stopped.set()
    model = FakeListChatModel(responses=['must not be produced'])
    with pytest.raises(RunCancelled):
        try:
            model.invoke('next model request', config={'callbacks': [CancellationGuard(stopped)]})
        except Exception:
            raise AssertionError('Cancellation was swallowed as a provider failure') from None


def test_cancel_a_run_resumed_after_process_restart(tmp_path):
    settings = settings_for(tmp_path)
    with TestClient(create_app(graph=ScriptedGraph(interrupt_script()), settings=settings)) as raw:
        user = AuthedClient(raw)
        run_id = user.post('/api/runs', json={'query': '查价格'}).json()['run_id']
        assert wait_terminal(user, run_id)['status'] == 'waiting_input'
        token = user.token
        raw.app.state.run_manager._pool.shutdown(wait=True)

    entered, release = threading.Event(), threading.Event()
    subsequent = Mock()

    class ResumedGraph:
        def stream(self, *args, **kwargs):
            entered.set()
            assert release.wait(10)
            yield (), 'updates', {'clarify': {'user_query': '茅台'}}
            subsequent()

    with TestClient(create_app(graph=ResumedGraph(), settings=settings)) as raw:
        headers = {'authorization': f'Bearer {token}'}
        try:
            assert raw.post(f'/api/runs/{run_id}/resume', json={'answer': '茅台'}, headers=headers).status_code == 202
            assert entered.wait(5)
            assert raw.post(f'/api/runs/{run_id}/cancel', headers=headers).json()['status'] == 'cancelling'
        finally:
            release.set()
            raw.app.state.run_manager._pool.shutdown(wait=True)
        assert raw.get(f'/api/runs/{run_id}', headers=headers).json()['status'] == 'cancelled'
        subsequent.assert_not_called()
