from dataclasses import dataclass
from typing import List, Dict, Any
from app.analysis.metadata import VideoMetadata


@dataclass
class ComputedMetric:
    metric_key: str
    value: float
    unit: str
    source: str  # "automated" | "coach_entered"
    calculation_method: str


def compute_metrics(
    metadata: VideoMetadata,
    frames: list,
    pose_results: List[List[Dict]],
) -> List[ComputedMetric]:
    """
    Compute only metrics derivable from real collected data.
    Never fabricates or estimates values.
    """
    metrics: List[ComputedMetric] = []

    # Always available: video metadata
    metrics.append(ComputedMetric(
        metric_key="video_duration_seconds",
        value=round(metadata.duration, 3),
        unit="seconds",
        source="automated",
        calculation_method="video_metadata_extraction",
    ))
    metrics.append(ComputedMetric(
        metric_key="video_fps",
        value=round(metadata.fps, 2),
        unit="fps",
        source="automated",
        calculation_method="video_metadata_extraction",
    ))
    metrics.append(ComputedMetric(
        metric_key="video_resolution_width",
        value=float(metadata.width),
        unit="pixels",
        source="automated",
        calculation_method="video_metadata_extraction",
    ))
    metrics.append(ComputedMetric(
        metric_key="video_resolution_height",
        value=float(metadata.height),
        unit="pixels",
        source="automated",
        calculation_method="video_metadata_extraction",
    ))
    metrics.append(ComputedMetric(
        metric_key="sampled_frame_count",
        value=float(len(frames)),
        unit="frames",
        source="automated",
        calculation_method="frame_sampling",
    ))

    # Pose-dependent metrics — only if pose ran
    detected_frames = [r for r in pose_results if len(r) > 0]
    if len(frames) > 0 and len(pose_results) > 0:
        detection_rate = len(detected_frames) / len(pose_results)
        metrics.append(ComputedMetric(
            metric_key="pose_detection_rate",
            value=round(detection_rate, 4),
            unit="ratio",
            source="automated",
            calculation_method="mediapipe_pose_landmarker",
        ))

    return metrics
