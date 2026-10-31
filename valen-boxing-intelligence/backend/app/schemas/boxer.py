from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class BoxerCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    date_of_birth: Optional[str] = Field(None, description="YYYY-MM-DD")
    weight_class: Optional[str] = Field(None, max_length=50)
    stance: Literal["orthodox", "southpaw", "switch"] = "orthodox"
    experience_level: Literal["amateur", "semi-pro", "professional"] = "amateur"
    primary_coach: Optional[str] = Field(None, max_length=150)
    training_goals: Optional[str] = None
    notes: Optional[str] = None


class BoxerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    date_of_birth: Optional[str] = Field(None, description="YYYY-MM-DD")
    weight_class: Optional[str] = Field(None, max_length=50)
    stance: Optional[Literal["orthodox", "southpaw", "switch"]] = None
    experience_level: Optional[Literal["amateur", "semi-pro", "professional"]] = None
    primary_coach: Optional[str] = Field(None, max_length=150)
    training_goals: Optional[str] = None
    notes: Optional[str] = None


class BoxerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    permanent_id: str
    full_name: str
    date_of_birth: Optional[str] = None
    weight_class: Optional[str] = None
    stance: str
    experience_level: str
    primary_coach: Optional[str] = None
    training_goals: Optional[str] = None
    notes: Optional[str] = None
    status: str
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BoxerListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    permanent_id: str
    full_name: str
    weight_class: Optional[str] = None
    stance: str
    experience_level: str
    primary_coach: Optional[str] = None
    status: str
    created_at: datetime
