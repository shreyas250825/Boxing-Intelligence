import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Metric(Base):
    __tablename__ = "metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    result_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=True)
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True)
    metric_key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # automated | coach_entered
    calculation_method: Mapped[str] = mapped_column(String(200), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    result = relationship("AnalysisResult", back_populates="metrics")
    boxer = relationship("Boxer", back_populates="metrics")
    session = relationship("TrainingSession", back_populates="metrics")
