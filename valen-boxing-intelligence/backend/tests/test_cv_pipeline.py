from __future__ import annotations

import cv2
import numpy as np

from app.analysis.events import BoxingEventDetector
from app.analysis.video_processor import VideoProcessor


def _make_video(path):
    writer = cv2.VideoWriter(
        str(path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        10,
        (64, 64),
    )
    for i in range(20):
        frame = np.zeros((64, 64, 3), dtype=np.uint8)
        frame[:, :, 0] = 20 + i
        frame[:, :, 1] = 30 + i
        frame[:, :, 2] = 40 + i
        cv2.circle(frame, (32, 32), 12, (255, 255, 255), -1)
        writer.write(frame)
    writer.release()


def test_video_processor_returns_quality_and_scene_cut_metadata(tmp_path):
    video = tmp_path / "sample.mp4"
    _make_video(video)

    processor = VideoProcessor(target_fps=5, max_frames=20)
    result = processor.process_video(str(video))

    assert result["frames_processed"] > 0
    assert result["target_fps"] == 5
    assert "samples" in result
    assert len(result["samples"]) > 0
    assert result["samples"][0]["quality"] >= 0.0
    assert "scene_cuts" in result


def test_boxing_event_detector_creates_evidence_based_event():
    detector = BoxingEventDetector()
    landmarks = {
        "left_wrist": [0.4, 0.8],
        "right_wrist": [0.6, 0.8],
        "left_elbow": [0.42, 0.65],
        "right_elbow": [0.58, 0.65],
        "left_shoulder": [0.35, 0.45],
        "right_shoulder": [0.65, 0.45],
        "nose": [0.5, 0.2],
    }
    sequence = [landmarks, {**landmarks, "left_wrist": [0.6, 0.75]}, {**landmarks, "left_wrist": [0.8, 0.5]}]

    events = detector.detect(sequence)

    assert len(events) >= 1
    assert events[0]["event_class"] in {"jab", "cross", "lead_hook", "rear_hook", "uppercut", "unclassified_punch"}
    assert events[0]["confidence"] >= 0.0
    assert events[0]["evidence_source"] in {"model", "coach", "heuristic"}
