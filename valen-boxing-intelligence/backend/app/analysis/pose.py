import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

_MEDIAPIPE_AVAILABLE = None
_pose_detector = None


def is_mediapipe_available() -> bool:
    global _MEDIAPIPE_AVAILABLE
    if _MEDIAPIPE_AVAILABLE is not None:
        return _MEDIAPIPE_AVAILABLE
    try:
        import mediapipe as mp  # noqa: F401
        _MEDIAPIPE_AVAILABLE = True
        logger.info("MediaPipe Pose Landmarker is available")
    except ImportError:
        _MEDIAPIPE_AVAILABLE = False
        logger.warning("MediaPipe not installed — pose estimation unavailable")
    return _MEDIAPIPE_AVAILABLE


def run_pose_landmarker(frame: "Any") -> List[Dict]:
    """
    Run pose estimation on a single frame.
    Returns list of landmark dicts if pose detected with confidence >= 0.5.
    Returns empty list if pose not detected or MediaPipe unavailable.
    """
    if not is_mediapipe_available():
        return []

    try:
        import mediapipe as mp
        import cv2

        mp_pose = mp.solutions.pose
        with mp_pose.Pose(
            static_image_mode=True,
            model_complexity=0,
            min_detection_confidence=0.5,
        ) as pose:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            if not results.pose_landmarks:
                return []

            landmarks = []
            for idx, lm in enumerate(results.pose_landmarks.landmark):
                if lm.visibility >= 0.5:
                    landmarks.append({
                        "index": idx,
                        "x": lm.x,
                        "y": lm.y,
                        "z": lm.z,
                        "visibility": lm.visibility,
                    })
            return landmarks
    except Exception as e:
        logger.warning("Pose estimation failed on frame: %s", e)
        return []
