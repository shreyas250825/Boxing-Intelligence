import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    fight_camp_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fight_camps.id", ondelete="SET NULL"), nullable=True)
    session_type: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    session_date: Mapped[str] = mapped_column(String(10), nullable=False)
    rounds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    round_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="training_sessions")
    fight_camp = relationship("FightCamp", back_populates="training_sessions")
    videos = relationship("Video", back_populates="session", passive_deletes=True)
    metrics = relationship("Metric", back_populates="session", passive_deletes=True)
    observations = relationship("Observation", back_populates="session", passive_deletes=True)
