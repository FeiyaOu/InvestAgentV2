"""The user's conversations: list from business tables, detail merges checkpointer turns and runs."""
from fastapi import APIRouter, Depends, HTTPException, Request

from api import repository
from api.db import session_scope
from api.deps import CurrentUser, current_user

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_conversations(request: Request, user: CurrentUser = Depends(current_user)):
    with session_scope(request.app.state.engine) as session:
        return repository.list_conversations(session, user.id)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, request: Request, user: CurrentUser = Depends(current_user)):
    with session_scope(request.app.state.engine) as session:
        conversation = repository.conversation_for_user(session, conversation_id, user.id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="conversation not found")
        title, turn_count = conversation.title, conversation.turn_count
    manager = request.app.state.run_manager
    runs = [{k: v for k, v in r.snapshot().items() if k not in {"analysis_snapshots", "strategy_series", "report_progress", "planner_attempts"}}
            for r in manager.store.for_conversation(conversation_id)]
    try:
        snapshot = manager.graph.get_state({"configurable": {"thread_id": conversation_id}})
        turns = list((snapshot.values or {}).get("turns") or [])
    except Exception:  # noqa: BLE001 - a stateless graph has no checkpointer to read.
        turns = []
    return {"conversation_id": conversation_id, "title": title, "turn_count": turn_count, "turns": turns, "runs": runs}
