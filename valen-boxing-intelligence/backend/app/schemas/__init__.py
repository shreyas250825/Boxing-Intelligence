from app.schemas.boxer import BoxerCreate, BoxerUpdate, BoxerResponse, BoxerListItem
from app.schemas.fight_camp import FightCampCreate, FightCampUpdate, FightCampResponse
from app.schemas.training_session import TrainingSessionCreate, TrainingSessionUpdate, TrainingSessionResponse
from app.schemas.video import VideoResponse, VideoUploadResponse
from app.schemas.analysis import AnalysisJobResponse, AnalysisResultResponse, AnalysisConfigRequest
from app.schemas.metric import MetricResponse
from app.schemas.observation import ObservationCreate, ObservationUpdate, ObservationResponse
from app.schemas.report import ReportRequest, ReportResponse

__all__ = [
    "BoxerCreate", "BoxerUpdate", "BoxerResponse", "BoxerListItem",
    "FightCampCreate", "FightCampUpdate", "FightCampResponse",
    "TrainingSessionCreate", "TrainingSessionUpdate", "TrainingSessionResponse",
    "VideoResponse", "VideoUploadResponse",
    "AnalysisJobResponse", "AnalysisResultResponse", "AnalysisConfigRequest",
    "MetricResponse",
    "ObservationCreate", "ObservationUpdate", "ObservationResponse",
    "ReportRequest", "ReportResponse",
]
