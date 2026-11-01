from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import cv2
import numpy as np


@dataclass
class FrameSample:
    timestamp: float
    frame_index: int
    quality: float
    blur_score: float
    brightness: float
    motion_score: float
    scene_cut: bool
    shot_id: int
    frame: Optional[np.ndarray] = None


class VideoProcessor:
    """Sequential video decoder that keeps memory usage bounded while computing frame quality and scene cuts.

    The implementation intentionally avoids loading an entire long video into RAM. It reads frames in a
    single pass and yields lightweight per-frame summaries that can be persisted for later analysis.
    """

    def __init__(self, target_fps: float = 5.0, max_frames: int = 500, min_quality: float = 0.05):
        self.target_fps = max(1.0, float(target_fps))
        self.max_frames = max(1, int(max_frames))
        self.min_quality = float(min_quality)
        self._last_gray: Optional[np.ndarray] = None
        self._last_hist: Optional[np.ndarray] = None
        self._shot_id = 0

    @staticmethod
    def _normalize_orientation(frame: np.ndarray) -> np.ndarray:
        if frame.shape[0] > frame.shape[1]:
            return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        return frame

    @staticmethod
    def _frame_quality(frame: np.ndarray) -> tuple[float, float, float]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(gray.mean() / 255.0)
        contrast = float(np.std(gray) / 255.0)
        quality = min(1.0, max(0.0, (contrast * 0.6) + (brightness * 0.4)))
        return quality, blur, brightness

    @staticmethod
    def _scene_cut_score(prev_gray: np.ndarray, curr_gray: np.ndarray) -> float:
        if prev_gray.shape != curr_gray.shape:
            return 1.0
        hist_prev = cv2.calcHist([prev_gray], [0], None, [64], [0, 256])
        hist_curr = cv2.calcHist([curr_gray], [0], None, [64], [0, 256])
        score = cv2.compareHist(hist_prev, hist_curr, cv2.HISTCMP_CORREL)
        return float(1.0 - max(0.0, min(1.0, score)))

    def process_video(self, video_path: str | Path, progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
        path = Path(video_path)
        if not path.exists():
            raise FileNotFoundError(f"Video file not found: {path}")

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video: {path}")

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        target_fps = self.target_fps if fps <= 0 else min(self.target_fps, fps)
        frame_step = max(1, int(round((fps or target_fps) / max(target_fps, 1e-6))))
        samples: List[FrameSample] = []
        scene_cuts: List[Dict[str, Any]] = []
        processed = 0
        shot_id = 0
        previous_gray: Optional[np.ndarray] = None
        previous_hist: Optional[np.ndarray] = None

        try:
            frame_index = 0
            while True:
                ok, frame = cap.read()
                if not ok or frame is None:
                    break
                if frame_index % frame_step != 0:
                    frame_index += 1
                    continue

                frame = self._normalize_orientation(frame)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                quality, blur_score, brightness = self._frame_quality(frame)
                motion_score = 0.0
                scene_cut = False
                if previous_gray is not None:
                    motion_score = self._scene_cut_score(previous_gray, gray)
                    if motion_score > 0.25:
                        scene_cut = True
                        shot_id += 1
                previous_gray = gray
                if previous_hist is None:
                    previous_hist = cv2.calcHist([gray], [0], None, [64], [0, 256])

                if processed >= self.max_frames:
                    frame_index += 1
                    continue

                timestamp = (frame_index / fps) if fps > 0 else (processed / target_fps)
                sample = FrameSample(
                    timestamp=timestamp,
                    frame_index=frame_index,
                    quality=float(quality),
                    blur_score=float(blur_score),
                    brightness=float(brightness),
                    motion_score=float(motion_score),
                    scene_cut=bool(scene_cut),
                    shot_id=shot_id,
                    frame=frame,
                )
                samples.append(sample)
                processed += 1

                if scene_cut:
                    scene_cuts.append({
                        "frame_index": frame_index,
                        "timestamp": timestamp,
                        "shot_id": shot_id,
                        "quality": quality,
                    })

                if progress_callback is not None:
                    progress_callback({
                        "processed": processed,
                        "total_frames": total_frames,
                        "timestamp": timestamp,
                        "shot_id": shot_id,
                    })

                frame_index += 1
        finally:
            cap.release()

        return {
            "video_path": str(path),
            "target_fps": float(target_fps),
            "frames_processed": len(samples),
            "duration_seconds": float((len(samples) / target_fps)) if samples else 0.0,
            "width": width,
            "height": height,
            "fps": fps,
            "samples": [
                {
                    "timestamp": s.timestamp,
                    "frame_index": s.frame_index,
                    "quality": s.quality,
                    "blur_score": s.blur_score,
                    "brightness": s.brightness,
                    "motion_score": s.motion_score,
                    "scene_cut": s.scene_cut,
                    "shot_id": s.shot_id,
                }
                for s in samples
            ],
            "scene_cuts": scene_cuts,
            "processing_status": "ok" if samples else "failed",
            "quality_threshold": self.min_quality,
        }
