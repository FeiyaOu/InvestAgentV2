"""Database access for users, conversations, runs, events and reports. One function per intent."""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, func
from sqlmodel import Session, select

from api.models import Conversation, Report, Run, RunEventRow, User, utcnow
from services.report_export import prepare_report


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _parse(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


# ---- users ----

def create_user(session: Session, *, email: str, password_hash: str, display_name: str = "") -> User:
    user = User(id="user_" + uuid4().hex, email=email.lower().strip(), password_hash=password_hash,
                display_name=display_name.strip() or email.split("@")[0])
    session.add(user)
    session.flush()
    return user


def user_by_email(session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email.lower().strip())).first()


def user_by_id(session: Session, user_id: str) -> User | None:
    return session.get(User, user_id)


# ---- conversations ----

def ensure_conversation(session: Session, *, conversation_id: str | None, user_id: str, title_hint: str) -> Conversation:
    """Return the caller's conversation, creating it on first use. Foreign ownership raises PermissionError."""
    if conversation_id:
        existing = session.get(Conversation, conversation_id)
        if existing is not None:
            if existing.user_id != user_id:
                raise PermissionError("conversation belongs to another user")
            return existing
    conversation = Conversation(id=conversation_id or "conv_" + uuid4().hex, user_id=user_id, title=title_hint[:80])
    session.add(conversation)
    session.flush()
    return conversation


def conversation_for_user(session: Session, conversation_id: str, user_id: str) -> Conversation | None:
    conversation = session.get(Conversation, conversation_id)
    return conversation if conversation is not None and conversation.user_id == user_id else None


def list_conversations(session: Session, user_id: str, *, limit: int = 100) -> list[dict]:
    rows = session.exec(select(Conversation).where(Conversation.user_id == user_id)
                        .order_by(Conversation.updated_at.desc()).limit(limit)).all()
    counts = dict(session.exec(select(Run.conversation_id, func.count(Run.run_id))
                               .where(Run.user_id == user_id).group_by(Run.conversation_id)).all())
    return [{"conversation_id": c.id, "title": c.title, "turn_count": c.turn_count, "last_status": c.last_status,
             "run_count": counts.get(c.id, 0), "created_at": _iso(c.created_at), "updated_at": _iso(c.updated_at)}
            for c in rows]


def touch_conversation(session: Session, conversation_id: str, *, status: str | None, counted: bool) -> None:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None:
        return
    conversation.updated_at = utcnow()
    conversation.last_status = status
    if counted:
        conversation.turn_count += 1
    session.add(conversation)


# ---- runs & events ----

def insert_run(session: Session, *, run_id: str, conversation_id: str, user_id: str, query: str) -> Run:
    run = Run(run_id=run_id, conversation_id=conversation_id, user_id=user_id, query=query)
    session.add(run)
    session.flush()
    return run


def update_run(session: Session, run_id: str, **fields) -> None:
    run = session.get(Run, run_id)
    if run is None:
        return
    for key, value in fields.items():
        if key in {"started_at", "finished_at"} and isinstance(value, str):
            value = _parse(value)
        setattr(run, key, value)
    session.add(run)


def append_event(session: Session, run_id: str, event: dict) -> None:
    session.add(RunEventRow(run_id=run_id, seq=event["seq"], type=event["type"], at=event["at"], scope=event["scope"],
                            task_id=event.get("task_id"), category=event.get("category"), payload=event.get("payload", {})))
    run = session.get(Run, run_id)
    if run is not None and event["seq"] > run.event_count:
        run.event_count = event["seq"]
        session.add(run)


def load_run(session: Session, run_id: str) -> Run | None:
    return session.get(Run, run_id)


def load_events(session: Session, run_id: str, after: int = 0) -> list[dict]:
    rows = session.exec(select(RunEventRow).where(RunEventRow.run_id == run_id, RunEventRow.seq > after)
                        .order_by(RunEventRow.seq)).all()
    return [{"seq": r.seq, "run_id": r.run_id, "type": r.type, "at": r.at, "scope": r.scope,
             "task_id": r.task_id, "category": r.category, "payload": r.payload} for r in rows]


def runs_for_conversation(session: Session, conversation_id: str) -> list[Run]:
    return session.exec(select(Run).where(Run.conversation_id == conversation_id).order_by(Run.created_at)).all()


def recent_runs(session: Session, user_id: str, *, limit: int = 50) -> list[Run]:
    return session.exec(select(Run).where(Run.user_id == user_id).order_by(Run.created_at.desc()).limit(limit)).all()


def fail_unfinished_runs(session: Session, message: str) -> int:
    """Startup recovery: runs that were live when the previous process died cannot resume."""
    rows = session.exec(select(Run).where(Run.status.in_(["queued", "running", "cancelling"]))).all()
    for run in rows:
        stopping = run.status == "cancelling"
        run.status = "cancelled" if stopping else "failed"
        run.finished_at = utcnow()
        run.error = None if stopping else {"type": "service_restarted", "message": message}
        session.add(run)
    return len(rows)


def run_to_dict(run: Run) -> dict:
    return {"run_id": run.run_id, "conversation_id": run.conversation_id, "user_id": run.user_id, "query": run.query,
            "status": run.status, "created_at": _iso(run.created_at), "started_at": _iso(run.started_at),
            "finished_at": _iso(run.finished_at), "elapsed_seconds": run.elapsed_seconds, "error": run.error,
            "event_count": run.event_count, "snapshot": run.snapshot}


# ---- reports ----

def save_reports(session: Session, *, run_id: str, conversation_id: str, user_id: str, state: dict) -> list[Report]:
    """Persist every readable report task (completed/partial with parseable final_report)."""
    saved = []
    planned = {task["task_id"]: task for task in (state.get("plan") or {}).get("tasks", [])}
    for task_id, record in (state.get("task_results") or {}).items():
        if record.get("category") != "report" or record.get("status") not in {"completed", "partial"}:
            continue
        raw = (record.get("result") or {}).get("final_report")
        if not raw:
            continue
        try:
            report, errors = prepare_report(raw)
        except ValueError:
            continue
        existing = session.exec(select(Report).where(Report.run_id == run_id, Report.task_id == task_id)).first()
        item = Report(id=existing.id if existing is not None else "report_" + uuid4().hex, run_id=run_id, task_id=task_id, user_id=user_id,
                      conversation_id=conversation_id, question=planned.get(task_id, record).get("question", ""),
                      title=str(report.get("research_topic") or ""), industry_focus=str(report.get("industry_focus") or ""),
                      time_horizon=str(report.get("time_horizon") or ""), report_date=str(report.get("report_date") or ""),
                      overall_rating=str(report.get("overall_rating") or ""), status=record["status"],
                      draft=bool(errors) or record["status"] == "partial", report=report, validation_errors=errors)
        if existing is not None:
            for key, value in item.model_dump(exclude={"id", "created_at"}).items():
                setattr(existing, key, value)
            item = existing
        session.add(item)
        saved.append(item)
    session.flush()
    return saved


def list_reports(session: Session, user_id: str, *, limit: int = 100) -> list[Report]:
    return session.exec(select(Report).where(Report.user_id == user_id).order_by(Report.created_at.desc()).limit(limit)).all()


def report_for_user(session: Session, report_id: str, user_id: str) -> Report | None:
    report = session.get(Report, report_id)
    return report if report is not None and report.user_id == user_id else None


def report_summary(report: Report) -> dict:
    return {"id": report.id, "run_id": report.run_id, "task_id": report.task_id, "conversation_id": report.conversation_id,
            "question": report.question, "title": report.title, "industry_focus": report.industry_focus,
            "time_horizon": report.time_horizon, "report_date": report.report_date, "overall_rating": report.overall_rating,
            "status": report.status, "draft": report.draft, "validation_errors": report.validation_errors,
            "created_at": _iso(report.created_at)}


DELETABLE_RUN_STATES = {'completed', 'failed', 'cancelled'}


def delete_run(session: Session, run_id: str) -> None:
    """Caller checks ownership and terminal state; delete children before parent FK."""
    row = session.get(Run, run_id)
    if row is None:
        return
    cid = row.conversation_id
    session.exec(delete(Report).where(Report.run_id == run_id))
    session.exec(delete(RunEventRow).where(RunEventRow.run_id == run_id))
    session.delete(row)
    session.flush()
    remaining = runs_for_conversation(session, cid)
    conversation = session.get(Conversation, cid)
    if conversation is not None:
        conversation.turn_count = sum(r.status in DELETABLE_RUN_STATES for r in remaining)
        last = remaining[-1] if remaining else None
        state = ((last.snapshot or {}).get('state') or {}) if last else {}
        conversation.last_status = (last.status if last and last.status == 'cancelled' else
                                    state.get('supervisor_status') or state.get('planning_status') or
                                    (last.status if last else None))
        conversation.title = remaining[0].query[:80] if remaining else '空对话'
        conversation.updated_at = utcnow()
        session.add(conversation)


def delete_conversation(session: Session, conversation_id: str) -> None:
    row = session.get(Conversation, conversation_id)
    if row is None:
        return
    run_ids = select(Run.run_id).where(Run.conversation_id == conversation_id)
    session.exec(delete(Report).where(Report.conversation_id == conversation_id))
    session.exec(delete(RunEventRow).where(RunEventRow.run_id.in_(run_ids)))
    session.exec(delete(Run).where(Run.conversation_id == conversation_id))
    session.delete(row)
