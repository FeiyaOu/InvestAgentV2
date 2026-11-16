"""Page-scoped guest workspaces: no account DB, files, or durable checkpoints."""
import threading
import time
from uuid import uuid4

from api.db import init_db, make_engine, session_scope
from api.models import User
from api.runs import RunManager, RunStore


class GuestWorkspace:
    def __init__(self, graph, executor):
        self.id = 'guest_' + uuid4().hex
        self.engine = make_engine('sqlite://')
        init_db(self.engine)
        with session_scope(self.engine) as db:
            db.add(User(id=self.id, email=self.id + '@guest.invalid', password_hash='!', display_name='访客'))
        self.manager = RunManager(graph, RunStore(self.engine), executor=executor)
        self.last_seen = time.monotonic()
        self.closed = False
        self.disposed = False
        self._lock = threading.RLock()
        self._pending = []

    def close(self):
        with self._lock:
            if self.closed:
                return
            self.closed = True
            with self.manager.store._lock:
                records = list(self.manager.store._live.values())
            for record in records:
                self.manager.cancel(record)
            # A synchronous provider request may still be returning. Keep its
            # private DB until its final cancellation event has been written.
            self._pending = [record.future for record in records if record.future is not None]
            for future in self._pending:
                future.add_done_callback(lambda _: self._dispose_when_idle())
            self._dispose_when_idle()

    def _dispose_when_idle(self):
        with self._lock:
            if self.disposed or any(not future.done() for future in self._pending):
                return
            with self.engine.get_execution_options()['session_lock']:
                self.engine.dispose()
            self.disposed = True
            self.manager.graph = None
            self.manager.store._live.clear()


class GuestSessions:
    def __init__(self, graph_factory, executor, *, idle_seconds=900, max_sessions=32):
        self.graph_factory, self.executor = graph_factory, executor
        self.idle_seconds, self.max_sessions = idle_seconds, max_sessions
        self.sessions: dict[str, GuestWorkspace] = {}
        self._lock = threading.RLock()

    def create(self):
        self.reap()
        with self._lock:
            if len(self.sessions) >= self.max_sessions:
                raise ValueError('访客工作区暂满，请稍后重试。')
            workspace = GuestWorkspace(self.graph_factory(), self.executor)
            self.sessions[workspace.id] = workspace
            return workspace

    def get(self, ident):
        with self._lock:
            workspace = self.sessions.get(ident)
            if workspace is None:
                return None
            if time.monotonic() - workspace.last_seen > self.idle_seconds:
                self.close(ident)
                return None
            workspace.last_seen = time.monotonic()
            return workspace

    def close(self, ident):
        with self._lock:
            workspace = self.sessions.pop(ident, None)
        if workspace is not None:
            workspace.close()

    def reap(self):
        with self._lock:
            expired = [key for key, ws in self.sessions.items()
                       if time.monotonic() - ws.last_seen > self.idle_seconds]
        for key in expired:
            self.close(key)

    def shutdown(self):
        with self._lock:
            keys = list(self.sessions)
        for key in keys:
            self.close(key)
