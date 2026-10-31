from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


TrackStatus = Literal["PENDING", "TRACKING", "LOST", "UNCERTAIN"]


class ActivityPoint(BaseModel):
    t: float
    v: float
    boxer: Optional[str] = None


class ActivityBurst(BaseModel):
    start: float
    end: float
    peak: float
    duration: float


class ActionEvent(BaseModel):
    id: str
    timestamp: float = Field(..., ge=0)
    action_type: str = Field(..., min_length=1, max_length=40)
    label: str = Field(..., min_length=1, max_length=80)
    note: Optional[str] = None
    round_num: Optional[int] = None
    boxer_label: Optional[str] = None


class RoundConfig(BaseModel):
    num_rounds: int = 3
    round_duration: int = 180
    rest_duration: int = 60
    start_offset: float = 0.0


class ROIConfig(BaseModel):
    x: float = 0.0
    y: float = 0.0
    width: float = 1.0
    height: float = 1.0
    enabled: bool = False


class CoachSummary(BaseModel):
    went_well: Optional[str] = None
    needs_improvement: Optional[str] = None
    technical_issues: Optional[str] = None
    recommended_drills: Optional[str] = None
    next_session_objectives: Optional[str] = None


class TrackingSample(BaseModel):
    t: float = Field(..., ge=0)
    cx: float
    cy: float
    x: float
    y: float
    w: float
    h: float
    confidence: float = Field(..., ge=0, le=1)
    status: TrackStatus
    displacement: float = Field(0, ge=0)
    valid_points: int = Field(0, ge=0)
    camera_reliable: bool = False

    @field_validator("cx", "cy", "x", "y", "w", "h")
    @classmethod
    def coords_finite(cls, v: float) -> float:
        if v != v or v in (float("inf"), float("-inf")):
            raise ValueError("coordinate must be finite")
        if v < -0.05 or v > 1.05:
            raise ValueError("normalized coordinate out of range")
        return v


class LossInterval(BaseModel):
    start: float
    end: Optional[float] = None
    reason: str


class BoxerTrackRecord(BaseModel):
    label: str = Field(..., min_length=1, max_length=4)
    boxer_id: str = Field(..., min_length=1)
    name: str
    color: str
    bbox: Optional[dict[str, float]] = None
    identify_time: Optional[float] = Field(None, ge=0)
    identify_video_width: Optional[int] = Field(None, ge=0)
    identify_video_height: Optional[int] = Field(None, ge=0)
    total_movement: float = Field(..., ge=0)
    valid_sample_count: int = Field(0, ge=0)
    samples: List[TrackingSample] = Field(default_factory=list)
    loss_intervals: List[LossInterval] = Field(default_factory=list)

    @field_validator("samples")
    @classmethod
    def limit_samples(cls, v: List[TrackingSample]) -> List[TrackingSample]:
        if len(v) > 8000:
            raise ValueError("too many tracking samples")
        return v


class TrackingPayload(BaseModel):
    version: str
    measurement: str
    camera_compensated: bool = False
    video_width: int = Field(..., gt=0)
    video_height: int = Field(..., gt=0)
    report_status: Optional[str] = None
    completed_at: Optional[str] = None
    report: Optional[dict] = None
    boxers: List[BoxerTrackRecord]

    @field_validator("boxers")
    @classmethod
    def one_or_two(cls, v: List[BoxerTrackRecord]) -> List[BoxerTrackRecord]:
        if len(v) < 1 or len(v) > 2:
            raise ValueError("tracking must include 1 or 2 boxers")
        labels = [b.label for b in v]
        if len(set(labels)) != len(labels):
            raise ValueError("boxer labels must be unique")
        return v


class BrowserAnalysisCreate(BaseModel):
    video_id: str = Field(..., min_length=1)
    boxer_id: str = Field(..., min_length=1)
    fight_camp_id: Optional[str] = None
    average_visual_activity: Optional[float] = None
    peak_visual_activity: Optional[float] = None
    processed_frames: int = 0
    duration_seconds: Optional[float] = None
    activity_series: Optional[List[ActivityPoint]] = None
    activity_bursts: Optional[List[ActivityBurst]] = None
    action_events: Optional[List[ActionEvent]] = None
    roi_config: Optional[ROIConfig] = None
    round_config: Optional[RoundConfig] = None
    coach_summary: Optional[CoachSummary] = None
    tracking: Optional[TrackingPayload] = None
    report: Optional[dict] = None
    report_status: Optional[str] = None
    completed_at: Optional[datetime] = None

    @model_validator(mode="after")
    def totals_match_samples(self) -> "BrowserAnalysisCreate":
        if self.tracking:
            for boxer in self.tracking.boxers:
                summed = sum(s.displacement for s in boxer.samples)
                if abs(summed - boxer.total_movement) > 0.05 + 0.02 * max(1.0, boxer.total_movement):
                    raise ValueError(
                        f"Boxer {boxer.label} total_movement does not match sample displacements"
                    )
        return self


class BrowserAnalysisUpdate(BaseModel):
    average_visual_activity: Optional[float] = None
    peak_visual_activity: Optional[float] = None
    processed_frames: Optional[int] = None
    duration_seconds: Optional[float] = None
    activity_series: Optional[List[ActivityPoint]] = None
    activity_bursts: Optional[List[ActivityBurst]] = None
    action_events: Optional[List[ActionEvent]] = None
    roi_config: Optional[ROIConfig] = None
    round_config: Optional[RoundConfig] = None
    coach_summary: Optional[CoachSummary] = None
    tracking: Optional[TrackingPayload] = None
    report: Optional[dict] = None
    report_status: Optional[str] = None
    completed_at: Optional[datetime] = None


class BrowserAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    video_id: str
    boxer_id: str
    fight_camp_id: Optional[str] = None
    average_visual_activity: Optional[float] = None
    peak_visual_activity: Optional[float] = None
    processed_frames: int
    duration_seconds: Optional[float] = None
    activity_series_json: Optional[str] = None
    activity_bursts_json: Optional[str] = None
    action_events_json: Optional[str] = None
    roi_config_json: Optional[str] = None
    round_config_json: Optional[str] = None
    coach_summary_json: Optional[str] = None
    tracking_json: Optional[str] = None
    report_json: Optional[str] = None
    report_status: Optional[str] = None
    completed_at: Optional[datetime] = None
    methodology_version: str
    created_at: datetime
    updated_at: datetime
