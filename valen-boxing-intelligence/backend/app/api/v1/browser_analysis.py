import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import success_response, error_response
from app.models.browser_analysis import BrowserVideoAnalysis
from app.models.video import Video
from app.schemas.browser_analysis import (
    BrowserAnalysisCreate, BrowserAnalysisUpdate, BrowserAnalysisResponse
)

router = APIRouter(tags=["browser_analysis"])


def _serialize(obj):
    if obj is None:
        return None
    if isinstance(obj, list):
        return json.dumps([item.model_dump() if hasattr(item, "model_dump") else item for item in obj])
    return json.dumps(obj.model_dump() if hasattr(obj, "model_dump") else obj)


def _apply_update(analysis: BrowserVideoAnalysis, data) -> None:
    update_fields = data.model_dump(exclude_unset=True)
    list_fields = {"activity_series", "activity_bursts", "action_events"}
    obj_fields = {"roi_config", "round_config", "coach_summary"}
    for field, value in update_fields.items():
        if field == "tracking":
            analysis.tracking_json = _serialize(value) if value is not None else None
            if value is not None:
                analysis.methodology_version = "lk-pyramid-v2"
        elif field == "report":
            analysis.report_json = _serialize(value) if value is not None else None
        elif field in list_fields or field in obj_fields:
            setattr(analysis, f"{field}_json", _serialize(value) if value is not None else None)
        elif hasattr(analysis, field):
            setattr(analysis, field, value)


@router.post("/videos/{video_id}/browser-analysis", status_code=201)
def create_or_update_browser_analysis(
    video_id: str, data: BrowserAnalysisCreate, db: Session = Depends(get_db)
):
    if data.video_id != video_id:
        raise HTTPException(
            status_code=422,
            detail=error_response("VALIDATION_ERROR", "video_id in body must match the URL")["error"],
        )
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=404,
            detail=error_response("NOT_FOUND", "Video not found")["error"],
        )

    existing = db.query(BrowserVideoAnalysis).filter(
        BrowserVideoAnalysis.video_id == video_id
    ).first()

    if existing:
        _apply_update(existing, data)
        existing.boxer_id = data.boxer_id
        existing.fight_camp_id = data.fight_camp_id
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return success_response(BrowserAnalysisResponse.model_validate(existing).model_dump())

    analysis = BrowserVideoAnalysis(
        id=str(uuid.uuid4()),
        video_id=video_id,
        boxer_id=data.boxer_id,
        fight_camp_id=data.fight_camp_id,
        average_visual_activity=data.average_visual_activity,
        peak_visual_activity=data.peak_visual_activity,
        processed_frames=data.processed_frames,
        duration_seconds=data.duration_seconds,
        activity_series_json=_serialize(data.activity_series),
        activity_bursts_json=_serialize(data.activity_bursts),
        action_events_json=_serialize(data.action_events),
        roi_config_json=_serialize(data.roi_config),
        round_config_json=_serialize(data.round_config),
        coach_summary_json=_serialize(data.coach_summary),
        tracking_json=_serialize(data.tracking),
        report_json=_serialize(data.report),
        report_status=data.report_status,
        completed_at=data.completed_at,
        methodology_version="lk-pyramid-v2",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return success_response(BrowserAnalysisResponse.model_validate(analysis).model_dump())


@router.get("/videos/{video_id}/browser-analysis")
def get_browser_analysis(video_id: str, db: Session = Depends(get_db)):
    analysis = db.query(BrowserVideoAnalysis).filter(
        BrowserVideoAnalysis.video_id == video_id
    ).first()
    if not analysis:
        return success_response(None)
    return success_response(BrowserAnalysisResponse.model_validate(analysis).model_dump())


@router.put("/browser-analyses/{analysis_id}")
def update_browser_analysis(
    analysis_id: str, data: BrowserAnalysisUpdate, db: Session = Depends(get_db)
):
    analysis = db.query(BrowserVideoAnalysis).filter(
        BrowserVideoAnalysis.id == analysis_id
    ).first()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=error_response("NOT_FOUND", "Analysis not found")["error"]
        )
    _apply_update(analysis, data)
    analysis.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(analysis)
    return success_response(BrowserAnalysisResponse.model_validate(analysis).model_dump())


@router.delete("/browser-analyses/{analysis_id}", status_code=204)
def delete_browser_analysis(analysis_id: str, db: Session = Depends(get_db)):
    analysis = db.query(BrowserVideoAnalysis).filter(
        BrowserVideoAnalysis.id == analysis_id
    ).first()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=error_response("NOT_FOUND", "Analysis not found")["error"]
        )
    db.delete(analysis)
    db.commit()
