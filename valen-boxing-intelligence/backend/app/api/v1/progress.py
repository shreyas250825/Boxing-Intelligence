from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from collections import defaultdict

from app.core.database import get_db
from app.core.responses import success_response, paginated_response, error_response
from app.models.metric import Metric
from app.models.training_session import TrainingSession
from app.models.boxer import Boxer

router = APIRouter(tags=["progress"])


@router.get("/boxers/{boxer_id}/progress")
def get_progress(
    boxer_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise HTTPException(status_code=404, detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"])

    query = (
        db.query(Metric, TrainingSession)
        .outerjoin(TrainingSession, Metric.session_id == TrainingSession.id)
        .filter(Metric.boxer_id == boxer_id)
    )
    if start_date:
        query = query.filter(TrainingSession.session_date >= start_date)
    if end_date:
        query = query.filter(TrainingSession.session_date <= end_date)

    rows = query.all()
    grouped: dict = defaultdict(list)
    for metric, session in rows:
        grouped[metric.metric_key].append({
            "session_date": session.session_date if session else None,
            "value": metric.value,
            "session_type": session.session_type if session else "unknown",
            "source_note": metric.calculation_method,
        })

    return success_response(dict(grouped))


@router.get("/boxers/{boxer_id}/sessions")
def get_sessions(
    boxer_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise HTTPException(status_code=404, detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"])

    total = db.query(TrainingSession).filter(TrainingSession.boxer_id == boxer_id).count()
    sessions = (
        db.query(TrainingSession)
        .filter(TrainingSession.boxer_id == boxer_id)
        .order_by(TrainingSession.session_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    from app.schemas.training_session import TrainingSessionResponse
    items = [TrainingSessionResponse.model_validate(s).model_dump() for s in sessions]
    return paginated_response(items, page=page, page_size=page_size, total=total)


@router.get("/boxers/{boxer_id}/sessions/{session_id}/videos")
def get_session_videos(boxer_id: str, session_id: str, db: Session = Depends(get_db)):
    """Get videos associated with a specific training session."""
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise HTTPException(status_code=404, detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"])
    from app.models.video import Video
    from app.schemas.video import VideoResponse
    videos = db.query(Video).filter(Video.session_id == session_id, Video.boxer_id == boxer_id).all()
    return success_response([VideoResponse.model_validate(v).model_dump() for v in videos])