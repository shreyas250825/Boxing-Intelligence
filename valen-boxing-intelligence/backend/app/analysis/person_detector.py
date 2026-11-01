from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:  # pragma: no cover
    YOLO = None


@dataclass
class PersonDetection:
    box: tuple[float, float, float, float]
    confidence: float
    area: float
    center: tuple[float, float]
    crop: Optional[np.ndarray] = None
    source: str = "ultralytics-yolo"


class PersonDetector:
    """Real YOLO person detection, with a small heuristic post-filter for boxing scenes.

    This is genuine model inference. The appearance vector below is NOT a trained ReID model; it is a
    lightweight feature hash used only to support a temporary identity heuristic.
    """

    def __init__(self, model_name: str = "yolov8n.pt", conf_threshold: float = 0.35):
        self.model_name = model_name
        self.conf_threshold = conf_threshold
        self.model = None
        self.load_error: Optional[str] = None
        if YOLO is None:
            self.load_error = "Ultralytics is not installed in the active Python environment."
            return
        try:
            self.model = YOLO(model_name)
            self.model.to("cpu")
        except Exception as exc:  # pragma: no cover - environment-dependent branch
            self.model = None
            self.load_error = f"{type(exc).__name__}: {exc}"

    @property
    def status(self) -> str:
        return "ready" if self.model is not None else "unavailable"

    @property
    def is_ready(self) -> bool:
        return self.model is not None

    def _appearance_embedding(self, crop: Optional[np.ndarray]) -> np.ndarray:
        if crop is None or crop.size == 0:
            return np.zeros(32, dtype=np.float32)
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 8, 8], [0, 180, 0, 256, 0, 256])
        hist = cv2.normalize(hist, hist).flatten().astype(np.float32)
        return hist[:32]

    def detect(self, frame: np.ndarray) -> List[PersonDetection]:
        if self.model is None:
            raise RuntimeError(self.load_error or "Person detection model is unavailable.")

        results = self.model(frame, classes=[0], verbose=False, imgsz=640, conf=self.conf_threshold)
        detections: List[PersonDetection] = []
        height, width = frame.shape[:2]
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                conf = float(box.conf[0])
                if conf < self.conf_threshold:
                    continue
                w = max(0.0, x2 - x1)
                h = max(0.0, y2 - y1)
                area = w * h
                if area <= 100:
                    continue
                center = ((x1 + x2) / 2.0 / width, (y1 + y2) / 2.0 / height)
                crop = frame[int(y1): int(y2), int(x1): int(x2)]
                if crop.size == 0:
                    continue
                aspect = w / max(h, 1e-6)
                if aspect < 0.2 or aspect > 2.6:
                    continue
                detections.append(PersonDetection(
                    box=(x1 / width, y1 / height, w / width, h / height),
                    confidence=conf,
                    area=area,
                    center=center,
                    crop=crop,
                    source="ultralytics-yolo",
                ))
        return sorted(detections, key=lambda item: item.confidence, reverse=True)
