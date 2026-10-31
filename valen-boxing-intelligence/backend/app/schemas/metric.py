from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class MetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    metric_key: str
    value: float
    unit: str
    source: Literal["automated", "coach_entered"]
    calculation_method: str
    recorded_at: datetime
