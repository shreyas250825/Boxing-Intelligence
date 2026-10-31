from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.responses import success_response, paginated_response, error_response
from app.schemas.boxer import BoxerCreate, BoxerUpdate, BoxerResponse, BoxerListItem
from app.services import boxer_service
from app.services.boxer_service import DuplicateBoxerError, BoxerNotFoundError

router = APIRouter(prefix="/boxers", tags=["boxers"])


@router.post("", status_code=201)
def register_boxer(data: BoxerCreate, db: Session = Depends(get_db)):
    try:
        boxer = boxer_service.create_boxer(db, data)
        return success_response(BoxerResponse.model_validate(boxer).model_dump())
    except DuplicateBoxerError as e:
        raise HTTPException(
            status_code=409,
            detail=error_response(
                code="BOXER_DUPLICATE",
                message="A boxer with this name and date of birth already exists.",
                details={"existing_boxer_id": e.existing_id},
            )["error"],
        )


@router.get("")
def list_boxers(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    boxers, total = boxer_service.list_boxers(db, search=search, page=page, page_size=page_size)
    items = [BoxerListItem.model_validate(b).model_dump() for b in boxers]
    return paginated_response(items, page=page, page_size=page_size, total=total)


@router.get("/{boxer_id}")
def get_boxer(boxer_id: str, db: Session = Depends(get_db)):
    boxer = boxer_service.get_boxer(db, boxer_id)
    if not boxer:
        raise HTTPException(
            status_code=404,
            detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"],
        )
    return success_response(BoxerResponse.model_validate(boxer).model_dump())


@router.put("/{boxer_id}")
def update_boxer(boxer_id: str, data: BoxerUpdate, db: Session = Depends(get_db)):
    try:
        boxer = boxer_service.update_boxer(db, boxer_id, data)
        return success_response(BoxerResponse.model_validate(boxer).model_dump())
    except BoxerNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"],
        )


@router.post("/{boxer_id}/archive")
def archive_boxer(boxer_id: str, db: Session = Depends(get_db)):
    try:
        boxer = boxer_service.archive_boxer(db, boxer_id)
        return success_response(BoxerResponse.model_validate(boxer).model_dump())
    except BoxerNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"],
        )


@router.delete("/{boxer_id}", status_code=204)
def delete_boxer(boxer_id: str, db: Session = Depends(get_db)):
    """Permanently delete a boxer. Requires no associated videos or sessions (use archive instead)."""
    from app.models.training_session import TrainingSession
    from app.models.video import Video
    boxer = boxer_service.get_boxer(db, boxer_id)
    if not boxer:
        raise HTTPException(status_code=404, detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"])
    # Safety: check for associated records
    session_count = db.query(TrainingSession).filter(TrainingSession.boxer_id == boxer_id).count()
    video_count = db.query(Video).filter(Video.boxer_id == boxer_id).count()
    if session_count > 0 or video_count > 0:
        raise HTTPException(
            status_code=409,
            detail=error_response(
                "BOXER_HAS_RECORDS",
                f"This boxer has {session_count} session(s) and {video_count} video(s). Archive them instead, or delete associated records first.",
                {"session_count": session_count, "video_count": video_count}
            )["error"]
        )
    db.delete(boxer)
    db.commit()


@router.get("/{boxer_id}/videos")
def list_boxer_videos(boxer_id: str, db: Session = Depends(get_db)):
    """List all videos uploaded for a boxer."""
    from app.models.video import Video
    from app.schemas.video import VideoResponse
    boxer = boxer_service.get_boxer(db, boxer_id)
    if not boxer:
        raise HTTPException(status_code=404, detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"])
    videos = db.query(Video).filter(Video.boxer_id == boxer_id).order_by(Video.uploaded_at.desc()).all()
    return success_response([VideoResponse.model_validate(v).model_dump() for v in videos])