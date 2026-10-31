from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class TrainingSessionCreate(BaseModel):
    boxer_id: str
    fight_camp_id: Optional[str] = None
    session_type: Literal["shadowboxing", "heavy_bag", "pad_work", "sparring", "other"] = "other"
    session_date: str = Field(..., description="YYYY-MM-DD")
    rounds: Optional[int] = Field(None, ge=1, le=50)
    round_duration_seconds: Optional[int] = Field(None, ge=60, le=600)
    objectives: Optional[str] = None
    coach_notes: Optional[str] = None


class TrainingSessionUpdate(BaseModel):
    session_type: Optional[Literal["shadowboxing", "heavy_bag", "pad_work", "sparring", "other"]] = None
    session_date: Optional[str] = None
    rounds: Optional[int] = Field(None, ge=1, le=50)
    round_duration_seconds: Optional[int] = Field(None, ge=60, le=600)
    objectives: Optional[str] = None
    coach_notes: Optional[str] = None


class TrainingSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    boxer_id: str
    fight_camp_id: Optional[str] = None
    session_type: str
    session_date: str
    rounds: Optional[int] = None
    round_duration_seconds: Optional[int] = None
    objectives: Optional[str] = None
    coach_notes: Optional[str] = None
    created_at: datetime
