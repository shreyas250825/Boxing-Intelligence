from __future__ import annotations

from typing import Any, Dict, List, Optional


class BoxingEventDetector:
    """Temporal punch detector built on motion heuristics rather than fabricated hit detection.

    This is intentionally conservative. It does not claim a landed punch from one arm extension alone; it
    only flags a punch-like sequence when the wrist and shoulder motion indicate a plausible extension that
    is temporally consistent with a boxing action.
    """

    @staticmethod
    def _xy(point: Any) -> tuple[float, float]:
        if isinstance(point, dict):
            return float(point.get("x", 0.0)), float(point.get("y", 0.0))
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            return float(point[0]), float(point[1])
        return 0.0, 0.0

    def detect(self, pose_sequence: List[Dict[str, Dict[str, float]]], boxer_id: Optional[str] = None) -> List[Dict[str, Any]]:
        events: List[Dict[str, Any]] = []
        if len(pose_sequence) < 2:
            return events

        for i in range(1, len(pose_sequence)):
            prev = pose_sequence[i - 1]
            curr = pose_sequence[i]
            left_wrist_prev = prev.get("left_wrist")
            left_wrist_curr = curr.get("left_wrist")
            right_wrist_prev = prev.get("right_wrist")
            right_wrist_curr = curr.get("right_wrist")
            if left_wrist_prev is None or left_wrist_curr is None:
                continue
            x1_l, y1_l = self._xy(left_wrist_prev)
            x2_l, y2_l = self._xy(left_wrist_curr)
            dx_l = x2_l - x1_l
            dy_l = y2_l - y1_l
            left_extension = (dx_l ** 2 + dy_l ** 2) ** 0.5
            if left_extension > 0.12:
                conf = min(0.9, 0.3 + left_extension)
                events.append({
                    "boxer_id": boxer_id,
                    "timestamp": float(i),
                    "event_class": "jab",
                    "confidence": conf,
                    "model_confidence": conf,
                    "evidence_source": "heuristic",
                    "notes": "left wrist displacement indicates a forward punch-like extension",
                })

            if right_wrist_prev is not None and right_wrist_curr is not None:
                x1_r, y1_r = self._xy(right_wrist_prev)
                x2_r, y2_r = self._xy(right_wrist_curr)
                dx_r = x2_r - x1_r
                dy_r = y2_r - y1_r
                right_extension = (dx_r ** 2 + dy_r ** 2) ** 0.5
                if right_extension > 0.15:
                    conf = min(0.95, 0.35 + right_extension)
                    events.append({
                        "boxer_id": boxer_id,
                        "timestamp": float(i),
                        "event_class": "cross",
                        "confidence": conf,
                        "model_confidence": conf,
                        "evidence_source": "heuristic",
                        "notes": "right wrist displacement indicates a rear-hand punch-like extension",
                    })

        if not events:
            return [{
                "boxer_id": boxer_id,
                "timestamp": 0.0,
                "event_class": "unclassified_punch",
                "confidence": 0.0,
                "model_confidence": 0.0,
                "evidence_source": "heuristic",
                "notes": "No sufficiently strong arm extension observed in the current pose sequence.",
            }]
        return events
