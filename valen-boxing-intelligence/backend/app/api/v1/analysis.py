from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.responses import success_response, error_response
from app.schemas.analysis import AnalysisJobResponse, AnalysisResultResponse, AnalysisConfigRequest
from app.schemas.metric import MetricResponse
from app.services import analysis_service
from app.services.analysis_service import AnalysisJobInProgressError, AnalysisJobNotFoundError
from app.analysis.runner import start_analysis_job

router = APIRouter(tags=["analysis"])


@router.post("/videos/{video_id}/analyse", status_code=201)
def enqueue_analysis(video_id: str, config: Optional[AnalysisConfigRequest] = None, db: Session = Depends(get_db)):
    from app.services.video_service import get_video
    video = get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail=error_response("VIDEO_NOT_FOUND", "Video not found")["error"])

    try:
        job = analysis_service.enqueue_job(db, video_id, config.model_dump() if config else None)
    except AnalysisJobInProgressError as e:
        raise HTTPException(
            status_code=409,
            detail=error_response("ANALYSIS_JOB_IN_PROGRESS", "An analysis job is already running for this video.", {"job_id": e.job_id})["error"],
        )

    # Start background thread
    start_analysis_job(job.id)

    return success_response(AnalysisJobResponse.from_orm_with_result_id(job).model_dump())


@router.get("/analysis-jobs/{job_id}")
def get_analysis_job(job_id: str, db: Session = Depends(get_db)):
    job = analysis_service.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=error_response("JOB_NOT_FOUND", "Analysis job not found")["error"])
    return success_response(AnalysisJobResponse.from_orm_with_result_id(job).model_dump())


@router.get("/analysis-results/{result_id}")
def get_analysis_result(result_id: str, db: Session = Depends(get_db)):
    result = analysis_service.get_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail=error_response("RESULT_NOT_FOUND", "Analysis result not found")["error"])

    from app.models.metric import Metric
    metrics = db.query(Metric).filter(Metric.result_id == result_id).all()
    result_data = AnalysisResultResponse.model_validate(result).model_dump()
    result_data["metrics"] = [MetricResponse.model_validate(m).model_dump() for m in metrics]
    return success_response(result_data)


@router.delete("/analysis-jobs/{job_id}", status_code=200)
def cancel_analysis_job(job_id: str, db: Session = Depends(get_db)):
    try:
        job = analysis_service.cancel_job(db, job_id)
        return success_response(AnalysisJobResponse.from_orm_with_result_id(job).model_dump())
    except AnalysisJobNotFoundError:
        raise HTTPException(status_code=404, detail=error_response("JOB_NOT_FOUND", "Analysis job not found")["error"])
