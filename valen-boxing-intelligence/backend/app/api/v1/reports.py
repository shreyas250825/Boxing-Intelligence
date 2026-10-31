from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success_response, error_response
from app.schemas.report import ReportRequest, ReportResponse
from app.services import report_service
from app.services.report_service import ReportGenerationError

router = APIRouter(tags=["reports"])


@router.post("/reports", status_code=201)
def generate_report(data: ReportRequest, db: Session = Depends(get_db)):
    try:
        report = report_service.generate_report(db, data.boxer_id, data.session_ids, data.title)
        return success_response({"report_id": report.id, "filename": report.storage_filename})
    except ReportGenerationError as e:
        if e.code == "REPORT_INSUFFICIENT_DATA":
            raise HTTPException(status_code=422, detail=error_response(e.code, str(e))["error"])
        elif e.code == "BOXER_NOT_FOUND":
            raise HTTPException(status_code=404, detail=error_response(e.code, str(e))["error"])
        elif e.code == "SESSION_OWNERSHIP_ERROR":
            raise HTTPException(status_code=422, detail=error_response(e.code, str(e))["error"])
        else:
            raise HTTPException(status_code=500, detail=error_response(e.code, str(e))["error"])


@router.get("/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)):
    from app.models.report import Report
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail=error_response("REPORT_NOT_FOUND", "Report not found")["error"])
    return success_response(ReportResponse.model_validate(report).model_dump())


@router.get("/reports/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db)):
    path = report_service.get_report_path(db, report_id)
    if not path:
        raise HTTPException(status_code=404, detail=error_response("REPORT_FILE_NOT_FOUND", "Report file not found on disk")["error"])
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id[:8]}.pdf"},
    )


@router.get("/boxers/{boxer_id}/reports")
def list_reports(boxer_id: str, db: Session = Depends(get_db)):
    reports = report_service.list_reports(db, boxer_id)
    return success_response([ReportResponse.model_validate(r).model_dump() for r in reports])
