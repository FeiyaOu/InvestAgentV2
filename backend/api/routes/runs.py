"""Create, inspect, stream and resume runs. Every route is scoped to the authenticated owner."""
import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from api.deps import (
    CurrentUser,
    current_user,
    current_user_or_query_token,
    owned_run,
    request_engine,
    request_manager,
)
from api.runs import TERMINAL, RunManager, RunRecord
from api.schemas import CreateRunRequest, ResumeRunRequest, RunCreated

router = APIRouter(prefix="/runs", tags=["runs"])


def _manager(request: Request) -> RunManager:
    return request_manager(request)


@router.post("", response_model=RunCreated, status_code=202)
def create_run(body: CreateRunRequest, request: Request, user: CurrentUser = Depends(current_user)):
    try:
        record = _manager(request).start(query=body.query, conversation_id=body.conversation_id, user_id=user.id)
    except PermissionError:
        raise HTTPException(status_code=403, detail="该对话属于其他用户") from None
    return RunCreated(run_id=record.run_id, conversation_id=record.conversation_id, status=record.status)


@router.get("")
def list_runs(request: Request, user: CurrentUser = Depends(current_user), limit: int = Query(default=50, ge=1, le=200)):
    from api import repository
    from api.db import session_scope
    with session_scope(request_engine(request)) as session:
        rows = repository.recent_runs(session, user.id, limit=limit)
        return [{k: v for k, v in repository.run_to_dict(r).items() if k not in {"snapshot", "user_id"}} for r in rows]


@router.get("/{run_id}")
def get_run(record: RunRecord = Depends(owned_run)):
    return record.snapshot()


@router.delete('/{run_id}', status_code=204)
def delete_run(request: Request, record: RunRecord = Depends(owned_run)):
    from api import repository
    from api.db import session_scope

    store = _manager(request).store
    with store.management_lock, record.lifecycle_lock:
        with session_scope(store.engine) as session:
            row = repository.load_run(session, record.run_id)
            if row is None:
                raise HTTPException(status_code=404, detail='run not found')
            if row.status not in repository.DELETABLE_RUN_STATES:
                raise HTTPException(status_code=409, detail='请先停止研究，再删除记录。')
            repository.delete_run(session, record.run_id)
        with store._lock:
            store._live.pop(record.run_id, None)
    return Response(status_code=204)


@router.get("/{run_id}/events/list")
def list_events(record: RunRecord = Depends(owned_run), after: int = Query(default=0, ge=0)):
    return record.events_after(after)


@router.post("/{run_id}/resume", status_code=202)
def resume_run(body: ResumeRunRequest, request: Request, record: RunRecord = Depends(owned_run)):
    try:
        _manager(request).resume(record, body.answer)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return record.snapshot()


@router.post("/{run_id}/retry", status_code=202)
def retry_run(request: Request, record: RunRecord = Depends(owned_run)):
    try:
        replay = _manager(request).retry(record)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return replay.snapshot()


@router.post("/{run_id}/cancel", status_code=202)
def cancel_run(request: Request, record: RunRecord = Depends(owned_run)):
    return _manager(request).cancel(record).snapshot()


def _sse(event: dict) -> str:
    return f"id: {event['seq']}\nevent: {event['type']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/{run_id}/events")
async def stream_events(run_id: str, request: Request, user: CurrentUser = Depends(current_user_or_query_token),
                        after: int = Query(default=0, ge=0)):
    """Replay events after `after`, then follow live until the run finishes or waits for input."""
    record = _manager(request).store.get(run_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status_code=404, detail="run not found")
    poll = request.app.state.settings.sse_poll_seconds

    async def generate():
        cursor = after
        while True:
            for event in record.events_after(cursor):
                cursor = event["seq"]
                yield _sse(event)
            with record.lock:
                done = record.status in TERMINAL and cursor >= len(record.events)
            if done or await request.is_disconnected():
                break
            await asyncio.sleep(poll)

    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
    return StreamingResponse(generate(), media_type="text/event-stream", headers=headers)
