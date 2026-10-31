import uuid
from datetime import datetime
from sqlalchemy import String, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Observation(Base):
    __tablename__ = "observations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id: Mapped[str] = mapped_column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True)
    timestamp_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_drill: Mapped[str | None] = mapped_column(String(500), nullable=True)
    review_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    video = relationship("Video", back_populates="observations")
    boxer = relationship("Boxer", back_populates="observations")
    session = relationship("TrainingSession", back_populates="observations")
