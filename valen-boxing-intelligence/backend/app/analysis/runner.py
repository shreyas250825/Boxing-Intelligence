import threading
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)


def start_analysis_job(job_id: str) -> None:
    """Spawn a daemon thread to run the analysis pipeline."""
    def _run():
        db: Session = SessionLocal()
        try:
            from app.analysis.pipeline import run_analysis_pipeline
            run_analysis_pipeline(job_id, db)
        except Exception as e:
            logger.error("Unhandled error in analysis thread for job %s: %s", job_id, e)
        finally:
            db.close()

    thread = threading.Thread(target=_run, daemon=True, name=f"analysis-{job_id[:8]}")
    thread.start()
    logger.info("Analysis thread started for job %s", job_id)
