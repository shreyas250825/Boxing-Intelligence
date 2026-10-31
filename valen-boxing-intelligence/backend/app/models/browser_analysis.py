import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class BrowserVideoAnalysis(Base):
    __tablename__ = "browser_video_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id: Mapped[str] = mapped_column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, unique=True)
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    fight_camp_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("fight_camps.id", ondelete="SET NULL"), nullable=True)
    average_visual_activity: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_visual_activity: Mapped[float | None] = mapped_column(Float, nullable=True)
    processed_frames: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    activity_series_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    activity_bursts_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_events_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    roi_config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    round_config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_summary_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    tracking_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    methodology_version: Mapped[str] = mapped_column(String(20), nullable=False, default="lk-pyramid-v2")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    video = relationship("Video", foreign_keys=[video_id])
    boxer = relationship("Boxer", foreign_keys=[boxer_id])