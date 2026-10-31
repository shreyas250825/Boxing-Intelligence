from app.models.boxer import Boxer
from app.models.fight_camp import FightCamp
from app.models.training_session import TrainingSession
from app.models.video import Video
from app.models.analysis_job import AnalysisJob
from app.models.analysis_result import AnalysisResult
from app.models.metric import Metric
from app.models.observation import Observation
from app.models.report import Report
from app.models.browser_analysis import BrowserVideoAnalysis

__all__ = [
    "Boxer", "FightCamp", "TrainingSession", "Video",
    "AnalysisJob", "AnalysisResult", "Metric", "Observation", "Report",
    "BrowserVideoAnalysis"
]