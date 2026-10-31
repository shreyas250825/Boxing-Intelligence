import uuid
import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.analysis_job import AnalysisJob
from app.models.analysis_result import AnalysisResult


class AnalysisJobInProgressError(Exception):
    def __init__(self, job_id: str):
        self.job_id = job_id
        super().__init__(f"Analysis job already in progress: {job_id}")


class AnalysisJobNotFoundError(Exception):
    pass


def enqueue_job(db: Session, video_id: str, config: Optional[dict] = None) -> AnalysisJob:
    """Enqueue a new analysis job. Raises if one is already queued/processing."""
    existing = db.query(AnalysisJob).filter(
        AnalysisJob.video_id == video_id,
        AnalysisJob.status.in_(["queued", "processing"]),
    ).first()
    if existing:
        raise AnalysisJobInProgressError(existing.id)

    job = AnalysisJob(
        id=str(uuid.uuid4()),
        video_id=video_id,
        status="queued",
        config_json=json.dumps(config) if config else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Optional[AnalysisJob]:
    return db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()


def cancel_job(db: Session, job_id: str) -> AnalysisJob:
    job = get_job(db, job_id)
    if not job:
        raise AnalysisJobNotFoundError(job_id)
    if job.status in ("completed", "failed", "cancelled"):
        return job  # already terminal
    if job.status == "queued":
        job.status = "cancelled"
        job.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
    return job


def get_result(db: Session, result_id: str) -> Optional[AnalysisResult]:
    return db.query(AnalysisResult).filter(AnalysisResult.id == result_id).first()


def get_result_for_job(db: Session, job_id: str) -> Optional[AnalysisResult]:
    return db.query(AnalysisResult).filter(AnalysisResult.job_id == job_id).first()
