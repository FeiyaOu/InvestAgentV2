"""Report library: persisted final reports with Markdown/HTML downloads."""
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from api import repository
from api.db import session_scope
from api.deps import CurrentUser, current_user, request_engine
from services.report_export import export_bundle

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
def list_reports(request: Request, user: CurrentUser = Depends(current_user)):
    with session_scope(request_engine(request)) as session:
        return [repository.report_summary(r) for r in repository.list_reports(session, user.id)]


@router.get("/{report_id}")
def get_report(report_id: str, request: Request, user: CurrentUser = Depends(current_user)):
    with session_scope(request_engine(request)) as session:
        report = repository.report_for_user(session, report_id, user.id)
        if report is None:
            raise HTTPException(status_code=404, detail="report not found")
        return {**repository.report_summary(report), "report": report.report}


@router.get("/{report_id}/download")
def download_report(report_id: str, request: Request, user: CurrentUser = Depends(current_user),
                    format: str = Query(default="md", pattern="^(md|html)$")):
    with session_scope(request_engine(request)) as session:
        report = repository.report_for_user(session, report_id, user.id)
        if report is None:
            raise HTTPException(status_code=404, detail="report not found")
        bundle = export_bundle(report.report, report.validation_errors, status=report.status, task_id=report.task_id)
    body = bundle["markdown"] if format == "md" else bundle["html"]
    media = "text/markdown; charset=utf-8" if format == "md" else "text/html; charset=utf-8"
    filename = f"{bundle['filename']}.{format}"
    headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    return Response(content=body, media_type=media, headers=headers)
