"""Thread history read from the checkpointer plus the runs this process knows about."""
from fastapi import APIRouter, HTTPException, Request

from api.schemas import ConversationView

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/{conversation_id}", response_model=ConversationView)
def get_conversation(conversation_id: str, request: Request):
    manager = request.app.state.run_manager
    runs = [r.snapshot() for r in manager.store.for_conversation(conversation_id)]
    try:
        snapshot = manager.graph.get_state({"configurable": {"thread_id": conversation_id}})
        turns = list((snapshot.values or {}).get("turns") or [])
    except Exception:  # noqa: BLE001 - a stateless graph has no checkpointer to read.
        turns = []
    if not runs and not turns:
        raise HTTPException(status_code=404, detail="conversation not found")
    return ConversationView(conversation_id=conversation_id, turns=turns, runs=runs)
