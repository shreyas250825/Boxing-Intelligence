import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_jobs.id", ondelete="CASCADE"), nullable=False, unique=True)
    video_id: Mapped[str] = mapped_column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    width_px: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    height_px: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fps: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sampled_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pose_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pose_detected_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    analysed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    job = relationship("AnalysisJob", back_populates="result")
    metrics = relationship("Metric", back_populates="result", passive_deletes=True)
