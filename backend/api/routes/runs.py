"""Create, inspect, stream and resume runs."""
import asyncio
import json

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from api.runs import TERMINAL, RunManager, RunRecord
from api.schemas import CreateRunRequest, ResumeRunRequest, RunCreated

router = APIRouter(prefix="/runs", tags=["runs"])


def _manager(request: Request) -> RunManager:
    return request.app.state.run_manager


def _record(request: Request, run_id: str) -> RunRecord:
    record = _manager(request).store.get(run_id)
    if record is None:
        raise HTTPException(status_code=404, detail="run not found")
    return record


@router.post("", response_model=RunCreated, status_code=202)
def create_run(body: CreateRunRequest, request: Request):
    record = _manager(request).start(body.query, body.conversation_id)
    return RunCreated(run_id=record.run_id, conversation_id=record.conversation_id, status=record.status)


@router.get("/{run_id}")
def get_run(run_id: str, request: Request):
    return _record(request, run_id).snapshot()


@router.get("/{run_id}/events/list")
def list_events(run_id: str, request: Request, after: int = Query(default=0, ge=0)):
    return _record(request, run_id).events_after(after)


@router.post("/{run_id}/resume", status_code=202)
def resume_run(run_id: str, body: ResumeRunRequest, request: Request):
    record = _record(request, run_id)
    try:
        _manager(request).resume(record, body.answer)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return record.snapshot()


def _sse(event: dict) -> str:
    return f"id: {event['seq']}\nevent: {event['type']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/{run_id}/events")
async def stream_events(run_id: str, request: Request, after: int = Query(default=0, ge=0)):
    """Replay events after `after`, then follow live until the run finishes or waits for input."""
    record = _record(request, run_id)
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
