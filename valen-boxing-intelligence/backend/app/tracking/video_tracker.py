from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

from app.tracking.identity_tracker import DetectionCandidate, IdentityAwareTracker


@dataclass
class TrackingAnchor:
    boxer_id: str
    label: str
    bbox: Tuple[float, float, float, float]
    frame_index: int
    timestamp: float
    embedding: Optional[np.ndarray] = None


@dataclass
class TrackingObservation:
    timestamp: float
    frame_number: int
    shot_id: int
    boxer_id: str
    bbox: Dict[str, float]
    detection_confidence: float
    identity_confidence: float
    appearance_similarity: float
    pose_confidence: float
    tracking_state: str
    is_verified: bool
    uncertainty_reason: Optional[str]


class IdentityAwareVideoTracker:
    """CPU-safe identity-aware person tracker built around YOLO person detection + appearance matching.

    Model inference status:
    - YOLO person detection: real model inference.
    - Appearance embedding: heuristic feature summary, not a trained ReID model.
    - Identity assignment logic: heuristic gating using motion + appearance; intentionally conservative.
    - Any uncertain detection is marked UNCERTAIN rather than silently re-labeled.
    """

    def __init__(self, model_name: str = "yolov8n.pt", conf_threshold: float = 0.35, iou_threshold: float = 0.45):
        self.model_name = model_name
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.model = YOLO(model_name)
        self.model.fuse()
        self.model.to("cpu")
        self.model.overrides["conf"] = conf_threshold
        self.model.overrides["max_det"] = 20

    def _appearance_embedding(self, crop: np.ndarray) -> np.ndarray:
        if crop.size == 0:
            return np.zeros(64, dtype=np.float32)
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [6, 6, 6], [0, 180, 0, 256, 0, 256])
        hist = cv2.normalize(hist, hist).flatten().astype(np.float32)
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        gy, gx = np.gradient(gray.astype(np.float32))
        grad_mag = np.hypot(gx, gy)
        grad_vec = cv2.normalize(grad_mag, None, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        feat = np.concatenate([hist[:32], grad_vec.flatten()[:32]])
        if feat.size < 64:
            feat = np.pad(feat, (0, 64 - feat.size), mode="constant")
        return feat[:64].astype(np.float32)

    def _yolo_detections_for_frame(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        results = self.model(frame, classes=[0], verbose=False, imgsz=640)
        detections: List[Dict[str, Any]] = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                conf = float(box.conf[0])
                if conf < self.conf_threshold:
                    continue
                detections.append({
                    "bbox": (x1 / frame.shape[1], y1 / frame.shape[0], (x2 - x1) / frame.shape[1], (y2 - y1) / frame.shape[0]),
                    "confidence": conf,
                    "crop": frame[int(y1):int(y2), int(x1):int(x2)],
                })
        return detections

    @staticmethod
    def _bbox_iou(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]) -> float:
        ax1, ay1, aw, ah = a
        bx1, by1, bw, bh = b
        ax2, ay2 = ax1 + aw, ay1 + ah
        bx2, by2 = bx1 + bw, by1 + bh
        inter_x1 = max(ax1, bx1)
        inter_y1 = max(ay1, by1)
        inter_x2 = min(ax2, bx2)
        inter_y2 = min(ay2, by2)
        inter_w = max(0.0, inter_x2 - inter_x1)
        inter_h = max(0.0, inter_y2 - inter_y1)
        inter = inter_w * inter_h
        union = max(1e-6, aw * ah + bw * bh - inter)
        return inter / union

    def _camera_shot_id(self, prev_hist: Optional[np.ndarray], frame: np.ndarray) -> int:
        hist = cv2.calcHist([cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)], [0, 1, 2], None, [32, 32, 32], [0, 180, 0, 256, 0, 256])
        hist = cv2.normalize(hist, hist).flatten()
        if prev_hist is None:
            return 0
        similarity = float(np.dot(prev_hist, hist) / (np.linalg.norm(prev_hist) * np.linalg.norm(hist) + 1e-8))
        return 0 if similarity > 0.6 else 1

    def run_video(self, video_path: str, anchors: List[TrackingAnchor], sample_every: int = 5) -> Dict[str, Any]:
        path = Path(video_path)
        if not path.exists():
            raise FileNotFoundError(f"Video not found: {video_path}")

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

        tracker = IdentityAwareTracker(boxer_ids=[a.boxer_id for a in anchors])
        for anchor in anchors:
            tracker.add_anchor(anchor.boxer_id, anchor.bbox, anchor.embedding or np.zeros(64, dtype=np.float32))

        observations: List[TrackingObservation] = []
        frame_index = 0
        last_hist: Optional[np.ndarray] = None
        shot_id = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % sample_every != 0:
                frame_index += 1
                continue

            current_shot = shot_id
            if last_hist is not None:
                hist = cv2.calcHist([cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)], [0, 1, 2], None, [32, 32, 32], [0, 180, 0, 256, 0, 256])
                hist = cv2.normalize(hist, hist).flatten()
                similarity = float(np.dot(last_hist, hist) / (np.linalg.norm(last_hist) * np.linalg.norm(hist) + 1e-8))
                if similarity < 0.65:
                    shot_id += 1
                    current_shot = shot_id
            last_hist = cv2.calcHist([cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)], [0, 1, 2], None, [32, 32, 32], [0, 180, 0, 256, 0, 256])
            last_hist = cv2.normalize(last_hist, last_hist).flatten()

            detections = self._yolo_detections_for_frame(frame)
            assigned: List[DetectionCandidate] = []
            for item in detections:
                x, y, w, h = item["bbox"]
                emb = self._appearance_embedding(item["crop"])
                assigned.append(DetectionCandidate(
                    boxer_id="unknown",
                    bbox=(x, y, w, h),
                    confidence=item["confidence"],
                    embedding=emb,
                    timestamp=frame_index / fps,
                    frame_number=frame_index,
                    shot_id=current_shot,
                ))

            results = tracker.assign_detections(assigned)
            for candidate in results:
                if candidate.is_assigned:
                    identity_conf = max(0.0, min(1.0, 0.6 * candidate.confidence + 0.4 * float(np.dot(candidate.embedding, tracker.anchors[candidate.boxer_id]) / (np.linalg.norm(candidate.embedding) * np.linalg.norm(tracker.anchors[candidate.boxer_id]) + 1e-8))))
                    observations.append(TrackingObservation(
                        timestamp=float(frame_index / fps),
                        frame_number=frame_index,
                        shot_id=current_shot,
                        boxer_id=candidate.boxer_id,
                        bbox={
                            "x": float(candidate.bbox[0]),
                            "y": float(candidate.bbox[1]),
                            "width": float(candidate.bbox[2]),
                            "height": float(candidate.bbox[3]),
                        },
                        detection_confidence=float(candidate.confidence),
                        identity_confidence=float(identity_conf),
                        appearance_similarity=float(np.dot(candidate.embedding, tracker.anchors[candidate.boxer_id]) / (np.linalg.norm(candidate.embedding) * np.linalg.norm(tracker.anchors[candidate.boxer_id]) + 1e-8)),
                        pose_confidence=0.0,
                        tracking_state="TRACKED",
                        is_verified=True,
                        uncertainty_reason=None,
                    ))
                else:
                    observations.append(TrackingObservation(
                        timestamp=float(frame_index / fps),
                        frame_number=frame_index,
                        shot_id=current_shot,
                        boxer_id="UNKNOWN",
                        bbox={
                            "x": float(candidate.bbox[0]),
                            "y": float(candidate.bbox[1]),
                            "width": float(candidate.bbox[2]),
                            "height": float(candidate.bbox[3]),
                        },
                        detection_confidence=float(candidate.confidence),
                        identity_confidence=0.0,
                        appearance_similarity=0.0,
                        pose_confidence=0.0,
                        tracking_state="UNCERTAIN",
                        is_verified=False,
                        uncertainty_reason="appearance and motion did not meet identity threshold",
                    ))

            frame_index += 1

        cap.release()

        by_boxer: Dict[str, List[TrackingObservation]] = {bid: [] for bid in tracker.boxer_ids}
        for obs in observations:
            if obs.boxer_id in by_boxer:
                by_boxer[obs.boxer_id].append(obs)

        payload = {
            "version": "identity-v1",
            "measurement": "normalized_image_plane_movement",
            "camera_compensated": False,
            "video_width": width,
            "video_height": height,
            "boxers": [],
            "observations": [asdict(obs) for obs in observations],
            "shot_count": max(1, shot_id + 1),
            "processed_frames": frame_index,
            "fps": float(fps),
            "duration_seconds": float(frame_index / fps),
        }

        for boxer_id in tracker.boxer_ids:
            boxer_obs = by_boxer.get(boxer_id, [])
            payload["boxers"].append({
                "boxer_id": boxer_id,
                "label": boxer_id,
                "observations": [asdict(obs) for obs in boxer_obs],
                "verified_frames": len([obs for obs in boxer_obs if obs.is_verified]),
                "uncertain_frames": len([obs for obs in boxer_obs if not obs.is_verified]),
            })

        return payload

    def process_and_write(self, video_path: str, anchors: List[TrackingAnchor], output_json: str) -> Dict[str, Any]:
        payload = self.run_video(video_path, anchors)
        out = Path(output_json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return payload
