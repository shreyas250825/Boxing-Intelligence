import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DevelopmentGoal(Base):
    __tablename__ = "development_goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)
    target_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    success_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_coach: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    progress_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    completion_percent: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="development_goals")


class TrainingJournalEntry(Base):
    __tablename__ = "training_journal_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    session_date: Mapped[str] = mapped_column(String(10), nullable=False)
    session_type: Mapped[str] = mapped_column(String(50), nullable=False, default="training")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    focus: Mapped[str | None] = mapped_column(String(200), nullable=True)
    what_went_well: Mapped[str | None] = mapped_column(Text, nullable=True)
    needs_improvement: Mapped[str | None] = mapped_column(Text, nullable=True)
    questions_for_coach: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    coach_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="training_journal_entries")


class SkillAssessment(Base):
    __tablename__ = "skill_assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    skill_name: Mapped[str] = mapped_column(String(100), nullable=False)
    current_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    development_goal: Mapped[str | None] = mapped_column(String(150), nullable=True)
    coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assigned_drill: Mapped[str | None] = mapped_column(String(200), nullable=True)
    review_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_assessed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="skill_assessments")


class RecoveryCheckin(Base):
    __tablename__ = "recovery_checkins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    entry_date: Mapped[str] = mapped_column(String(10), nullable=False)
    energy_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    recovery_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    soreness_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    stress_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    readiness_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="recovery_checkins")


class CompetitionPlan(Base):
    __tablename__ = "competition_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    competition_name: Mapped[str] = mapped_column(String(200), nullable=False)
    competition_date: Mapped[str] = mapped_column(String(10), nullable=False)
    weight_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timeline: Mapped[str | None] = mapped_column(Text, nullable=True)
    milestones: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_checklist: Mapped[str | None] = mapped_column(Text, nullable=True)
    equipment_checklist: Mapped[str | None] = mapped_column(Text, nullable=True)
    travel_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_competition_review: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planned")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="competition_plans")
