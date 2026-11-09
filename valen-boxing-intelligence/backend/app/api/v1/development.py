from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.responses import error_response, success_response
from app.models.boxer import Boxer
from app.models.development import (
    CompetitionPlan,
    DevelopmentGoal,
    RecoveryCheckin,
    SkillAssessment,
    TrainingJournalEntry,
)

router = APIRouter(prefix="/development", tags=["development"])


def _boxer_or_404(db: Session, boxer_id: str) -> Boxer:
    boxer = db.query(Boxer).filter(Boxer.id == boxer_id).first()
    if not boxer:
        raise HTTPException(
            status_code=404,
            detail=error_response("BOXER_NOT_FOUND", "Boxer not found")["error"],
        )
    return boxer


def _serialize_model(model: Any) -> dict:
    return {column.name: getattr(model, column.name) for column in model.__table__.columns}


@router.post("/boxers/{boxer_id}/goals", status_code=201)
def create_goal(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    payload = dict(data)
    goal = DevelopmentGoal(boxer_id=boxer_id, **payload)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return success_response(_serialize_model(goal))


@router.get("/boxers/{boxer_id}/goals")
def list_goals(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    goals = db.query(DevelopmentGoal).filter(DevelopmentGoal.boxer_id == boxer_id).order_by(DevelopmentGoal.created_at.desc()).all()
    return success_response([_serialize_model(goal) for goal in goals])


@router.post("/boxers/{boxer_id}/journal", status_code=201)
def create_journal_entry(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    payload = dict(data)
    entry = TrainingJournalEntry(boxer_id=boxer_id, **payload)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return success_response(_serialize_model(entry))


@router.get("/boxers/{boxer_id}/journal")
def list_journal_entries(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    entries = db.query(TrainingJournalEntry).filter(TrainingJournalEntry.boxer_id == boxer_id).order_by(TrainingJournalEntry.session_date.desc()).all()
    return success_response([_serialize_model(entry) for entry in entries])


@router.post("/boxers/{boxer_id}/recovery-checkins", status_code=201)
def create_recovery_checkin(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    payload = dict(data)
    checkin = RecoveryCheckin(boxer_id=boxer_id, **payload)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return success_response(_serialize_model(checkin))


@router.get("/boxers/{boxer_id}/recovery-checkins")
def list_recovery_checkins(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    checkins = db.query(RecoveryCheckin).filter(RecoveryCheckin.boxer_id == boxer_id).order_by(RecoveryCheckin.entry_date.desc()).all()
    return success_response([_serialize_model(checkin) for checkin in checkins])


@router.post("/boxers/{boxer_id}/skill-assessments", status_code=201)
def create_skill_assessment(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    payload = dict(data)
    assessment = SkillAssessment(boxer_id=boxer_id, **payload)
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return success_response(_serialize_model(assessment))


@router.get("/boxers/{boxer_id}/skill-assessments")
def list_skill_assessments(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    assessments = db.query(SkillAssessment).filter(SkillAssessment.boxer_id == boxer_id).order_by(SkillAssessment.created_at.desc()).all()
    return success_response([_serialize_model(assessment) for assessment in assessments])


@router.post("/boxers/{boxer_id}/competition-plans", status_code=201)
def create_competition_plan(boxer_id: str, data: dict, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    payload = dict(data)
    plan = CompetitionPlan(boxer_id=boxer_id, **payload)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return success_response(_serialize_model(plan))


@router.get("/boxers/{boxer_id}/competition-plans")
def list_competition_plans(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)
    plans = db.query(CompetitionPlan).filter(CompetitionPlan.boxer_id == boxer_id).order_by(CompetitionPlan.created_at.desc()).all()
    return success_response([_serialize_model(plan) for plan in plans])


@router.get("/boxers/{boxer_id}/dashboard")
def get_development_dashboard(boxer_id: str, db: Session = Depends(get_db)):
    _boxer_or_404(db, boxer_id)

    primary_goal = (
        db.query(DevelopmentGoal)
        .filter(DevelopmentGoal.boxer_id == boxer_id)
        .order_by(DevelopmentGoal.is_primary.desc(), DevelopmentGoal.created_at.desc())
        .first()
    )
    journal_entries = (
        db.query(TrainingJournalEntry)
        .filter(TrainingJournalEntry.boxer_id == boxer_id)
        .order_by(TrainingJournalEntry.session_date.desc())
        .all()
    )
    recovery_checkins = (
        db.query(RecoveryCheckin)
        .filter(RecoveryCheckin.boxer_id == boxer_id)
        .order_by(RecoveryCheckin.entry_date.desc())
        .all()
    )

    return success_response(
        {
            "primary_goal": _serialize_model(primary_goal) if primary_goal else None,
            "journal_entries": [_serialize_model(entry) for entry in journal_entries],
            "recovery_checkins": [_serialize_model(checkin) for checkin in recovery_checkins],
            "goals": [
                _serialize_model(goal)
                for goal in db.query(DevelopmentGoal)
                .filter(DevelopmentGoal.boxer_id == boxer_id)
                .order_by(DevelopmentGoal.created_at.desc())
                .all()
            ],
            "skill_assessments": [
                _serialize_model(a)
                for a in db.query(SkillAssessment)
                .filter(SkillAssessment.boxer_id == boxer_id)
                .order_by(SkillAssessment.created_at.desc())
                .all()
            ],
        }
    )
