"""Request-scoped dependencies: current user and ownership checks."""
from fastapi import Depends, HTTPException, Query, Request

from api import repository
from api.db import session_scope
from api.security import decode_token


class CurrentUser:
    def __init__(self, user_id: str, email: str, display_name: str):
        self.id, self.email, self.display_name = user_id, email, display_name


def _resolve(request: Request, token: str | None) -> CurrentUser:
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    user_id = decode_token(token, request.app.state.settings.jwt_secret)
    if user_id is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
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
    record = request.app.state.run_manager.store.get(run_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="run not found")
    return record
