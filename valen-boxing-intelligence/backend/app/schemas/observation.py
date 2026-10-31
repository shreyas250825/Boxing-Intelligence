from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


ObservationCategory = Literal[
    "guard_position", "stance_and_balance", "footwork",
    "punch_execution", "return_to_guard", "defensive_movement",
    "timing_and_distance", "conditioning_related", "other"
]


class ObservationCreate(BaseModel):
    video_id: str
    boxer_id: str
    session_id: Optional[str] = None
    timestamp_seconds: float = Field(..., ge=0)
    category: ObservationCategory
    description: str = Field(..., min_length=5, max_length=1000)
    severity: Literal["low", "medium", "high"] = "medium"
    coach_notes: Optional[str] = None
    recommended_drill: Optional[str] = Field(None, max_length=500)
    review_status: Literal["pending", "reviewed", "resolved"] = "pending"


class ObservationUpdate(BaseModel):
    timestamp_seconds: Optional[float] = Field(None, ge=0)
    category: Optional[ObservationCategory] = None
    description: Optional[str] = Field(None, min_length=5, max_length=1000)
    severity: Optional[Literal["low", "medium", "high"]] = None
    coach_notes: Optional[str] = None
    recommended_drill: Optional[str] = Field(None, max_length=500)
    review_status: Optional[Literal["pending", "reviewed", "resolved"]] = None


class ObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    video_id: str
    boxer_id: str
    session_id: Optional[str] = None
    timestamp_seconds: float
    category: str
    description: str
    severity: str
    coach_notes: Optional[str] = None
    recommended_drill: Optional[str] = None
    review_status: str
    created_at: datetime
    updated_at: datetime
