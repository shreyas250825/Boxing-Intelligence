from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np


@dataclass
class DetectionCandidate:
    boxer_id: str
    bbox: Tuple[float, float, float, float]
    confidence: float
    embedding: np.ndarray
    timestamp: float
    frame_number: int = 0
    shot_id: int = 0
    state: str = "TRACKED"
    is_assigned: bool = False


@dataclass
class IdentityAssignment:
    boxer_id: str
    detection: DetectionCandidate
    identity_confidence: float
    appearance_similarity: float
    motion_score: float
    state: str
    is_assigned: bool = True


class IdentityAwareTracker:
    """Identity-aware assignment layer for Boxer A/B using appearance + motion gating.

    IMPORTANT: this is not a trained deep ReID model. The appearance vector is a compact heuristic based on
    image statistics and is used only to maintain identity continuity under controlled temporal tracking.
    When the video is ambiguous or occluded, the tracker intentionally returns an uncertain state instead of
    silently swapping boxer identities.
    """

    def __init__(self, boxer_ids: Optional[List[str]] = None, *, uncertainty_threshold: float = 0.45):
        self.boxer_ids = boxer_ids or []
        self.uncertainty_threshold = uncertainty_threshold
        self.anchors: Dict[str, np.ndarray] = {}
        self.anchor_boxes: Dict[str, Tuple[float, float, float, float]] = {}
        self.identity_history: Dict[str, List[np.ndarray]] = {bid: [] for bid in self.boxer_ids}

    def add_anchor(self, boxer_id: str, bbox: Tuple[float, float, float, float], embedding: np.ndarray) -> None:
        self.boxer_ids = list(dict.fromkeys(self.boxer_ids + [boxer_id]))
        self.anchors[boxer_id] = np.asarray(embedding, dtype=np.float32)
        self.anchor_boxes[boxer_id] = bbox
        self.identity_history.setdefault(boxer_id, []).append(self.anchors[boxer_id])

    def _appearance_similarity(self, embedding: np.ndarray, boxer_id: str) -> float:
        if boxer_id not in self.anchors:
            return 0.0
        emb = np.asarray(embedding, dtype=np.float32)
        anchor = self.anchors[boxer_id]
        if anchor.size == 0 or emb.size == 0:
            return 0.0
        norm = np.linalg.norm(anchor) * np.linalg.norm(emb)
        if norm <= 1e-8:
            return 0.0
        return float(np.dot(anchor, emb) / norm)

    def _motion_cost(self, boxer_id: str, detection: DetectionCandidate) -> float:
        if boxer_id not in self.anchor_boxes:
            return 0.5
        x, y, w, h = detection.bbox
        bx, by, bw, bh = self.anchor_boxes[boxer_id]
        dx = abs(x - bx)
        dy = abs(y - by)
        dw = abs(w - bw)
        dh = abs(h - bh)
        return float(np.clip((dx * 2.5 + dy * 2.5 + dw * 3.0 + dh * 3.0), 0.0, 1.0))

    def assign_detections(self, detections: List[DetectionCandidate]) -> List[DetectionCandidate]:
        """Assign detections to boxer identities using appearance-first matching with motion gating."""
        assigned: List[DetectionCandidate] = []
        remaining = list(detections)

        if not self.anchors:
            for d in remaining:
                d.is_assigned = False
                d.state = "UNCERTAIN"
                assigned.append(d)
            return assigned

        for d in remaining:
            best_boxer = None
            best_score = -1.0
            best_identity = 0.0
            best_motion = 1.0

            for boxer_id in self.boxer_ids:
                appearance = self._appearance_similarity(d.embedding, boxer_id)
                motion = self._motion_cost(boxer_id, d)
                score = (appearance * 0.7) + ((1.0 - motion) * 0.3)
                if score > best_score:
                    best_boxer = boxer_id
                    best_score = score
                    best_identity = appearance
                    best_motion = motion

            if best_boxer is None:
                d.is_assigned = False
                d.state = "UNCERTAIN"
                assigned.append(d)
                continue

            if best_score >= self.uncertainty_threshold and best_identity >= 0.15:
                d.boxer_id = best_boxer
                d.is_assigned = True
                d.state = "TRACKED"
                self.identity_history.setdefault(best_boxer, []).append(d.embedding)
                self.anchor_boxes[best_boxer] = d.bbox
                self.anchors[best_boxer] = d.embedding
                assigned.append(d)
            else:
                d.is_assigned = False
                d.state = "UNCERTAIN"
                assigned.append(d)

        return assigned
