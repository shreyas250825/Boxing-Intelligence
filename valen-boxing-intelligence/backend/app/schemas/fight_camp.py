from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


class FightCampCreate(BaseModel):
    boxer_id: str
    name: str = Field(..., min_length=1, max_length=200)
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    target_fight_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    status: Literal["planned", "active", "completed", "archived"] = "planned"
    objectives: Optional[str] = None
    coach_notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be earlier than start_date")
        return self


class FightCampUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    start_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    target_fight_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    status: Optional[Literal["planned", "active", "completed", "archived"]] = None
    objectives: Optional[str] = None
    coach_notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be earlier than start_date")
        return self


class FightCampResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    boxer_id: str
    name: str
    start_date: str
    end_date: Optional[str] = None
    target_fight_date: Optional[str] = None
    status: str
    objectives: Optional[str] = None
    coach_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
