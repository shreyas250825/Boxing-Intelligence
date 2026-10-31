from pathlib import Path
from typing import List, Tuple
import logging

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

logger = logging.getLogger(__name__)


def sample_frames(
    file_path: Path,
    interval_seconds: float = 0.5,
    max_frames: int = 500,
) -> List[Tuple[float, "np.ndarray"]]:
    """
    Sample frames from a video at a given interval.
    Returns list of (timestamp_seconds, frame_array) tuples.
    len(result) <= max_frames always.
    """
    if not CV2_AVAILABLE:
        logger.error("OpenCV not available — cannot sample frames")
        return []

    interval_seconds = max(0.1, min(interval_seconds, 10.0))
    max_frames = max(1, min(max_frames, 2000))

    cap = cv2.VideoCapture(str(file_path))
    if not cap.isOpened():
        logger.error("Could not open video: %s", file_path)
        return []

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if fps <= 0:
            return []

        frame_step = max(1, int(fps * interval_seconds))
        collected: List[Tuple[float, "np.ndarray"]] = []
        target_frame = 0

        while target_frame < total_frames and len(collected) < max_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, float(target_frame))
            success, frame = cap.read()
            if success and frame is not None:
                timestamp = target_frame / fps
                collected.append((timestamp, frame))
            target_frame += frame_step

        return collected
    finally:
        cap.release()
