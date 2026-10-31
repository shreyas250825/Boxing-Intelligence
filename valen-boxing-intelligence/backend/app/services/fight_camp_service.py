import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.fight_camp import FightCamp
from app.schemas.fight_camp import FightCampCreate, FightCampUpdate


class FightCampNotFoundError(Exception):
    pass


class BoxerNotFoundError(Exception):
    pass


def create_fight_camp(db: Session, data: FightCampCreate) -> FightCamp:
    from app.models.boxer import Boxer
    boxer = db.query(Boxer).filter(Boxer.id == data.boxer_id).first()
    if not boxer:
        raise BoxerNotFoundError(data.boxer_id)

    camp = FightCamp(
        id=str(uuid.uuid4()),
        boxer_id=data.boxer_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        target_fight_date=data.target_fight_date,
        status=data.status,
        objectives=data.objectives,
        coach_notes=data.coach_notes,
    )
    db.add(camp)
    db.commit()
    db.refresh(camp)
    return camp


def get_fight_camp(db: Session, camp_id: str) -> Optional[FightCamp]:
    return db.query(FightCamp).filter(FightCamp.id == camp_id).first()


def list_fight_camps(db: Session, boxer_id: str) -> list[FightCamp]:
    return (
        db.query(FightCamp)
        .filter(FightCamp.boxer_id == boxer_id)
        .order_by(FightCamp.start_date.desc())
        .all()
    )


def update_fight_camp(db: Session, camp_id: str, data: FightCampUpdate) -> FightCamp:
    camp = get_fight_camp(db, camp_id)
    if not camp:
        raise FightCampNotFoundError(camp_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camp, field, value)
    camp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(camp)
    return camp


def validate_session_camp_boxer(db: Session, fight_camp_id: str, boxer_id: str) -> None:
    """Raise ValueError if the camp belongs to a different boxer."""
    camp = get_fight_camp(db, fight_camp_id)
    if camp and camp.boxer_id != boxer_id:
        raise ValueError("Fight camp does not belong to the specified boxer.")
