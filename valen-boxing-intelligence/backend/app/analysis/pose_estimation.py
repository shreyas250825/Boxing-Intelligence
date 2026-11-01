from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover
    YOLO = None

try:
    import mediapipe as mp
except ImportError:  # pragma: no cover
    mp = None


POSE_KEYPOINTS = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]


@dataclass
class PoseEstimate:
    keypoints: Dict[str, Dict[str, float]]
    confidence: float
    source: str


class PoseEstimator:
    """Uses YOLO pose if available; MediaPipe is used as a fallback only where present.

    The model output is treated as evidence only for visible keypoints. Missing joints are not interpreted
    as verified positions. This keeps the analysis honest and avoids fabricating a pose when the model has
    no information for a limb.
    """

    def __init__(self):
        self.model = None
        if YOLO is not None:
            try:
                self.model = YOLO("yolov8n-pose.pt")
                self.model.to("cpu")
            except Exception:
                self.model = None
        self.mediapipe = mp is not None

    def _normalize_keypoints(self, keypoints: List[List[float]], confidence: Optional[List[float]] = None) -> Dict[str, Dict[str, float]]:
        normalized: Dict[str, Dict[str, float]] = {}
        for index, name in enumerate(POSE_KEYPOINTS):
            if index >= len(keypoints):
                continue
            point = keypoints[index]
            if len(point) < 2:
                continue
            conf = confidence[index] if confidence is not None and index < len(confidence) else 1.0
            normalized[name] = {
                "x": float(point[0]),
                "y": float(point[1]),
                "confidence": float(conf),
            }
        return normalized

    def estimate(self, frame: np.ndarray, bbox: Optional[tuple[float, float, float, float]] = None) -> Optional[PoseEstimate]:
        candidate = frame
        if bbox is not None:
            h, w = frame.shape[:2]
            x, y, bw, bh = bbox
            x1 = max(0, int(x * w))
            y1 = max(0, int(y * h))
            x2 = min(w, int((x + bw) * w))
            y2 = min(h, int((y + bh) * h))
            candidate = frame[y1:y2, x1:x2]
            if candidate.size == 0:
                return None

        if self.model is not None:
            try:
                results = self.model(candidate, verbose=False, imgsz=640)
                for result in results:
                    if getattr(result, "keypoints", None) is None:
                        continue
                    kp = result.keypoints
                    if hasattr(kp, "xy"):
                        points = kp.xy[0].cpu().numpy().tolist()
                        confs = kp.conf[0].cpu().numpy().tolist() if hasattr(kp, "conf") else [1.0] * len(points)
                        return PoseEstimate(self._normalize_keypoints(points, confs), float(np.mean(confs)) if confs else 0.0, "yolov8-pose")
            except Exception:
                pass

        if self.mediapipe:
            try:
                pose = mp.solutions.pose.Pose(static_image_mode=True, min_detection_confidence=0.3)
                rgb = cv2.cvtColor(candidate, cv2.COLOR_BGR2RGB)
                results = pose.process(rgb)
                if results.pose_landmarks:
                    landmark_map: Dict[str, Dict[str, float]] = {}
                    for idx, name in enumerate(POSE_KEYPOINTS):
                        landmark = results.pose_landmarks.landmark[idx] if idx < len(results.pose_landmarks.landmark) else None
                        if landmark is None:
                            continue
                        landmark_map[name] = {
                            "x": float(landmark.x),
                            "y": float(landmark.y),
                            "confidence": float(landmark.visibility),
                        }
                    return PoseEstimate(landmark_map, float(np.mean([v["confidence"] for v in landmark_map.values()])) if landmark_map else 0.0, "mediapipe")
            except Exception:
                pass

        return None
