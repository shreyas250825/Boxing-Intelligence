from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.metric import MetricResponse


class AnalysisConfigRequest(BaseModel):
    frame_interval_seconds: float = Field(0.5, ge=0.1, le=10.0)
    max_frames: int = Field(500, ge=1, le=2000)


class AnalysisJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    video_id: str
    status: Literal["queued", "processing", "completed", "failed", "cancelled"]
    queued_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result_id: Optional[str] = None

    @classmethod
    def from_orm_with_result_id(cls, job):
        result_id = job.result.id if job.result else None
        data = {
            "id": job.id,
            "video_id": job.video_id,
            "status": job.status,
            "queued_at": job.queued_at,
            "started_at": job.started_at,
            "completed_at": job.completed_at,
            "error_message": job.error_message,
            "result_id": result_id,
        }
        return cls(**data)


class AnalysisResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    video_id: str
    duration_seconds: float
    width_px: int
    height_px: int
    fps: float
    total_frames: int
    sampled_frames: int
    pose_available: bool
    pose_detected_frames: int
    metrics: List[MetricResponse] = []
    analysed_at: datetime
