import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.observation import Observation
from app.schemas.observation import ObservationCreate, ObservationUpdate


class ObservationNotFoundError(Exception):
    pass


def create_observation(db: Session, data: ObservationCreate) -> Observation:
    obs = Observation(
        id=str(uuid.uuid4()),
        video_id=data.video_id,
        boxer_id=data.boxer_id,
        session_id=data.session_id,
        timestamp_seconds=data.timestamp_seconds,
        category=data.category,
        description=data.description,
        severity=data.severity,
        coach_notes=data.coach_notes,
        recommended_drill=data.recommended_drill,
        review_status=data.review_status,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs


def get_observation(db: Session, obs_id: str) -> Optional[Observation]:
    return db.query(Observation).filter(Observation.id == obs_id).first()


def update_observation(db: Session, obs_id: str, data: ObservationUpdate) -> Observation:
    obs = get_observation(db, obs_id)
    if not obs:
        raise ObservationNotFoundError(obs_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obs, field, value)
    obs.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(obs)
    return obs


def delete_observation(db: Session, obs_id: str) -> None:
    obs = get_observation(db, obs_id)
    if not obs:
        raise ObservationNotFoundError(obs_id)
    db.delete(obs)
    db.commit()


def list_observations(db: Session, video_id: str) -> List[Observation]:
    return (
        db.query(Observation)
        .filter(Observation.video_id == video_id)
        .order_by(Observation.timestamp_seconds.asc())
        .all()
    )
