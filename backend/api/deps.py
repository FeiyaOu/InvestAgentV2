"""Request-scoped dependencies: current user and ownership checks."""
from fastapi import Depends, HTTPException, Query, Request

from api import repository
from api.db import session_scope
from api.security import decode_token


class CurrentUser:
    def __init__(self, user_id: str, email: str, display_name: str, *, is_guest: bool = False):
        self.id, self.email, self.display_name = user_id, email, display_name
        self.is_guest = is_guest


def _resolve(request: Request, token: str | None) -> CurrentUser:
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    user_id = decode_token(token, request.app.state.settings.jwt_secret)
    if user_id is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    if user_id.startswith('guest_'):
        workspace = request.app.state.guest_sessions.get(user_id)
        if workspace is None:
            raise HTTPException(status_code=401, detail='访客会话已结束，请重新打开首页。')
        request.state.guest_workspace = workspace
        return CurrentUser(user_id, '', '访客', is_guest=True)
    with session_scope(request.app.state.engine) as session:
        user = repository.user_by_id(session, user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="用户不存在")
        return CurrentUser(user.id, user.email, user.display_name)


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    return header[7:].strip() if header.lower().startswith("bearer ") else None


def current_user(request: Request) -> CurrentUser:
    return _resolve(request, bearer_token(request))


def current_user_or_query_token(request: Request, token: str | None = Query(default=None)) -> CurrentUser:
    """EventSource cannot set headers, so the SSE endpoint also accepts ?token=."""
    return _resolve(request, bearer_token(request) or token)


def owned_run(request: Request, run_id: str, user: CurrentUser = Depends(current_user)):
    record = request_manager(request).store.get(run_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="run not found")
    return record


def request_manager(request: Request):
    workspace = getattr(request.state, 'guest_workspace', None)
    return workspace.manager if workspace is not None else request.app.state.run_manager


def request_engine(request: Request):
    workspace = getattr(request.state, 'guest_workspace', None)
    return workspace.engine if workspace is not None else request.app.state.engine
