"""The user's conversations: list from business tables, detail merges checkpointer turns and runs."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from api import repository
from api.db import session_scope
from api.deps import CurrentUser, current_user, request_engine, request_manager

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.delete('/{conversation_id}', status_code=204)
def delete_conversation(conversation_id: str, request: Request, user: CurrentUser = Depends(current_user)):
    manager = request_manager(request)
    with manager.store.management_lock:
        with session_scope(request_engine(request)) as session:
            if repository.conversation_for_user(session, conversation_id, user.id) is None:
                raise HTTPException(status_code=404, detail='conversation not found')
            rows = repository.runs_for_conversation(session, conversation_id)
            if any(row.status not in repository.DELETABLE_RUN_STATES for row in rows):
                raise HTTPException(status_code=409, detail='此对话仍有未结束的研究，请先停止后再删除。')
            checkpoint = getattr(manager.graph, 'checkpointer', None)
            if checkpoint is not None:
                checkpoint.delete_thread(conversation_id)
            repository.delete_conversation(session, conversation_id)
    return Response(status_code=204)


@router.get("")
def list_conversations(request: Request, user: CurrentUser = Depends(current_user)):
    with session_scope(request_engine(request)) as session:
        return repository.list_conversations(session, user.id)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, request: Request, user: CurrentUser = Depends(current_user)):
    with session_scope(request_engine(request)) as session:
        conversation = repository.conversation_for_user(session, conversation_id, user.id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="conversation not found")
        title, turn_count = conversation.title, conversation.turn_count
    manager = request_manager(request)
    runs = [{k: v for k, v in r.snapshot().items() if k not in {"analysis_snapshots", "strategy_series", "report_progress", "planner_attempts"}}
            for r in manager.store.for_conversation(conversation_id)]
    # Display durable run records, not the compacted model-memory window. This
    # provides stable run IDs for deletion and never redisplays a deleted run.
    turns = [{"run_id": run["run_id"], "query": run["query"],
              "response_preview": (run["state"].get("composition_summary") or run["state"].get("final_response") or "")[:1200],
              "status": run["status"], "clarifications": run["state"].get("clarifications", []),
              "completed_at": run["finished_at"]}
             for run in runs if run["status"] in repository.DELETABLE_RUN_STATES and run["finished_at"]]
    return {"conversation_id": conversation_id, "title": title, "turn_count": turn_count, "turns": turns, "runs": runs}
