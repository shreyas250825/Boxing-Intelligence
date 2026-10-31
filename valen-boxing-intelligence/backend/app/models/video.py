import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True)
    storage_filename: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    original_filename_safe: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="uploaded")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="videos")
    session = relationship("TrainingSession", back_populates="videos")
    analysis_jobs = relationship("AnalysisJob", back_populates="video", passive_deletes=True)
    observations = relationship("Observation", back_populates="video", passive_deletes=True)
