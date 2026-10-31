import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    storage_filename: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    session_ids_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    generated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="reports")
