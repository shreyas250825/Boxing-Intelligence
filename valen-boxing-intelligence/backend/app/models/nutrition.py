import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class NutritionProfile(Base):
    __tablename__ = "nutrition_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), unique=True, nullable=False)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_competition_weight_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    dietary_preferences: Mapped[str | None] = mapped_column(String(200), nullable=True)
    vegetarian: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    food_allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    foods_to_avoid: Mapped[str | None] = mapped_column(Text, nullable=True)
    meal_timing: Mapped[str | None] = mapped_column(Text, nullable=True)
    training_schedule: Mapped[str | None] = mapped_column(Text, nullable=True)
    nutrition_goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    nutritionist_targets: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_calories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_fibre_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="nutrition_profiles")


class FoodEntry(Base):
    __tablename__ = "food_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    entry_date: Mapped[str] = mapped_column(String(10), nullable=False)
    meal_type: Mapped[str] = mapped_column(String(30), nullable=False)
    food_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[str | None] = mapped_column(String(50), nullable=True)
    serving_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    calories: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    protein_g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    carbs_g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    fat_g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    fibre_g: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    meal_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_estimate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="food_entries")


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    plan_date: Mapped[str] = mapped_column(String(10), nullable=False)
    meal_type: Mapped[str] = mapped_column(String(30), nullable=False, default="breakfast")
    foods_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    adherence_status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    assigned_nutritionist: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="meal_plans")


class HydrationEntry(Base):
    __tablename__ = "hydration_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    entry_date: Mapped[str] = mapped_column(String(10), nullable=False)
    drink_name: Mapped[str] = mapped_column(String(80), nullable=False)
    amount_ml: Mapped[int] = mapped_column(Integer, nullable=False)
    time_of_day: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="hydration_entries")


class WeightRecord(Base):
    __tablename__ = "weight_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    entry_date: Mapped[str] = mapped_column(String(10), nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    coach_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    nutritionist_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="weight_records")


class SupplementLog(Base):
    __tablename__ = "supplement_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    boxer_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxers.id", ondelete="RESTRICT"), nullable=False)
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timing: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    review_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    professional_review_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    boxer = relationship("Boxer", back_populates="supplement_logs")
