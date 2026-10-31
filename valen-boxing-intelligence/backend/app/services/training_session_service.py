import uuid
from sqlalchemy.orm import Session

from app.models.training_session import TrainingSession
from app.schemas.training_session import TrainingSessionCreate


def create_training_session(db: Session, data: TrainingSessionCreate) -> TrainingSession:
    # Validate fight_camp belongs to boxer if provided
    if data.fight_camp_id:
        from app.models.fight_camp import FightCamp
        camp = db.query(FightCamp).filter(FightCamp.id == data.fight_camp_id).first()
        if camp and camp.boxer_id != data.boxer_id:
            raise ValueError("Fight camp does not belong to the specified boxer.")

    session = TrainingSession(
        id=str(uuid.uuid4()),
        boxer_id=data.boxer_id,
        fight_camp_id=data.fight_camp_id,
        session_type=data.session_type,
        session_date=data.session_date,
        rounds=data.rounds,
        round_duration_seconds=data.round_duration_seconds,
        objectives=data.objectives,
        coach_notes=data.coach_notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
