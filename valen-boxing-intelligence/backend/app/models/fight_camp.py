import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class FightCamp(Base):
    __tablename__ = "fight_camps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_fight_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="fight_camps")
    training_sessions = relationship("TrainingSession", back_populates="fight_camp", passive_deletes=True)
