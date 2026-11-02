import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Boxer(Base):
    __tablename__ = "boxers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    permanent_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    date_of_birth: Mapped[str | None] = mapped_column(String(10), nullable=True)
    weight_class: Mapped[str | None] = mapped_column(String(50), nullable=True)
    stance: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    experience_level: Mapped[str] = mapped_column(String(20), nullable=False, default="amateur")
    primary_coach: Mapped[str | None] = mapped_column(String(150), nullable=True)
    training_goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    fight_camps = relationship("FightCamp", back_populates="boxer", passive_deletes=True)
    training_sessions = relationship("TrainingSession", back_populates="boxer", passive_deletes=True)
    videos = relationship("Video", back_populates="boxer", passive_deletes=True)
    metrics = relationship("Metric", back_populates="boxer", passive_deletes=True)
    observations = relationship("Observation", back_populates="boxer", passive_deletes=True)
    reports = relationship("Report", back_populates="boxer", passive_deletes=True)
    development_goals = relationship("DevelopmentGoal", back_populates="boxer", passive_deletes=True)
    training_journal_entries = relationship("TrainingJournalEntry", back_populates="boxer", passive_deletes=True)
    skill_assessments = relationship("SkillAssessment", back_populates="boxer", passive_deletes=True)
    recovery_checkins = relationship("RecoveryCheckin", back_populates="boxer", passive_deletes=True)
    competition_plans = relationship("CompetitionPlan", back_populates="boxer", passive_deletes=True)
    nutrition_profiles = relationship("NutritionProfile", back_populates="boxer", passive_deletes=True)
    food_entries = relationship("FoodEntry", back_populates="boxer", passive_deletes=True)
    meal_plans = relationship("MealPlan", back_populates="boxer", passive_deletes=True)
    hydration_entries = relationship("HydrationEntry", back_populates="boxer", passive_deletes=True)
    weight_records = relationship("WeightRecord", back_populates="boxer", passive_deletes=True)
    supplement_logs = relationship("SupplementLog", back_populates="boxer", passive_deletes=True)
