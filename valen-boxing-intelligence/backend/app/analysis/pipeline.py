import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.analysis.events import BoxingEventDetector
from app.analysis.metadata import extract_video_metadata, MetadataExtractionError
from app.analysis.person_detector import PersonDetector
from app.analysis.pose_estimation import PoseEstimator
from app.analysis.sampler import sample_frames
from app.analysis.video_processor import VideoProcessor
from app.analysis.metrics import compute_metrics
from app.core.config import settings
from app.models.analysis_job import AnalysisJob
from app.models.analysis_result import AnalysisResult
from app.models.metric import Metric
from app.models.video import Video

import uuid
import json

logger = logging.getLogger(__name__)


def run_analysis_pipeline(job_id: str, db: Session) -> None:
    """
    Main analysis pipeline. Updates job status throughout.
    Preconditions: job exists with status='queued', video file exists on disk.
    Postconditions: job.status is 'completed' or 'failed'.
    """
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job or job.status != "queued":
        logger.warning("Job %s not found or not queued, skipping", job_id)
        return

    # Update to processing
    job.status = "processing"
    job.started_at = datetime.utcnow()
    db.commit()

    try:
        video = db.query(Video).filter(Video.id == job.video_id).first()
        if not video:
            raise RuntimeError("Video record not found")

        storage_dir = Path(settings.STORAGE_DIR)
        file_path = storage_dir / video.storage_filename

        if not file_path.exists() or file_path.stat().st_size == 0:
            raise RuntimeError("Video file could not be opened. The file may be corrupt or in an unsupported codec.")

        # Parse config
        config = {}
        if job.config_json:
            try:
                config = json.loads(job.config_json)
            except Exception:
                config = {}

        interval = float(config.get("frame_interval_seconds", settings.FRAME_INTERVAL_SECONDS))
        max_frames = int(config.get("max_frames", settings.MAX_FRAMES))

        # Stage 2: Extract metadata
        metadata = extract_video_metadata(file_path)

        # Stage 3: Run the real video-processing pass that yields quality metrics and scene cuts
        processing_fps = float(config.get("processing_fps", max(1.0, min(10.0, interval * 5.0))))
        processor = VideoProcessor(target_fps=processing_fps, max_frames=max_frames)
        processing_summary = processor.process_video(file_path)

        # Stage 4: Sample frames for downstream analysis
        frames = sample_frames(file_path, interval_seconds=interval, max_frames=max_frames)

        # Stage 5: Real person detection and pose estimation using installed CV models
        detector = PersonDetector(conf_threshold=0.35)
        pose_estimator = PoseEstimator()
        detections = []
        pose_results = []
        boxer_events = []
        event_detector = BoxingEventDetector()
        boxer_a_pose_sequence = []

        for _, frame in frames:
            detected = detector.detect(frame)
            detections.append({
                "frame_index": len(detections),
                "detections": [
                    {
                        "bbox": box.box,
                        "confidence": box.confidence,
                        "center": list(box.center),
                        "area": box.area,
                    }
                    for box in detected
                ],
            })

            pose_for_frame = []
            for detection in detected[:2]:
                pose = pose_estimator.estimate(frame, detection.box)
                if pose is not None:
                    pose_for_frame.append({
                        "bbox": detection.box,
                        "keypoints": pose.keypoints,
                        "confidence": pose.confidence,
                        "source": pose.source,
                    })
            pose_results.append(pose_for_frame)
            if pose_for_frame:
                boxer_a_pose_sequence.append(pose_for_frame[0]["keypoints"])

        boxer_events.extend(event_detector.detect(boxer_a_pose_sequence, boxer_id="boxer_a"))

        # Stage 6: Compute metrics with a conservative interpretation of the CV evidence.
        computed = compute_metrics(metadata, frames, pose_results)

        # Stage 7: Persist evidence and results
        pose_available = any(len(r) > 0 for r in pose_results)
        reports_dir = Path(settings.REPORTS_DIR)
        reports_dir.mkdir(parents=True, exist_ok=True)
        evidence_path = reports_dir / f"{job_id}-cv-summary.json"
        evidence_path.write_text(json.dumps({
            "video_id": job.video_id,
            "processing_summary": processing_summary,
            "detections": detections,
            "pose_results": pose_results,
            "boxer_events": boxer_events,
            "metadata": {
                "duration_seconds": metadata.duration,
                "width_px": metadata.width,
                "height_px": metadata.height,
                "fps": metadata.fps,
                "total_frames": metadata.frame_count,
            },
        }, indent=2), encoding="utf-8")

        result = AnalysisResult(
            id=str(uuid.uuid4()),
            job_id=job_id,
            video_id=job.video_id,
            duration_seconds=metadata.duration,
            width_px=metadata.width,
            height_px=metadata.height,
            fps=metadata.fps,
            total_frames=metadata.frame_count,
            sampled_frames=len(frames),
            pose_available=pose_available,
            pose_detected_frames=sum(1 for r in pose_results if len(r) > 0),
        )
        db.add(result)
        db.flush()

        for m in computed:
            db.add(Metric(
                id=str(uuid.uuid4()),
                result_id=result.id,
                boxer_id=video.boxer_id,
                session_id=video.session_id,
                metric_key=m.metric_key,
                value=m.value,
                unit=m.unit,
                source=m.source,
                calculation_method=m.calculation_method,
            ))

        job.status = "completed"
        job.completed_at = datetime.utcnow()
        db.commit()
        logger.info("Analysis job %s completed successfully", job_id)

    except Exception as e:
        db.rollback()
        logger.error("Analysis job %s failed: %s", job_id, e)
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = f"{type(e).__name__}: {str(e)}"
            job.completed_at = datetime.utcnow()
            db.commit()
