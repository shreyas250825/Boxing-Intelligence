from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class VideoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    boxer_id: str
    session_id: Optional[str] = None
    storage_filename: str
    original_filename_safe: str
    mime_type: str
    file_size_bytes: int
    status: str
    uploaded_at: datetime


class VideoUploadResponse(BaseModel):
    video_id: str
    session_id: str
    status: str
    original_filename_safe: str
    file_size_bytes: int
    uploaded_at: datetime
