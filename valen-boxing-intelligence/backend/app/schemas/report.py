from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict


class ReportRequest(BaseModel):
    boxer_id: str
    session_ids: List[str]
    title: str = "Performance Report"


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    boxer_id: str
    storage_filename: str
    title: str
    session_ids_json: str
    generated_at: datetime
