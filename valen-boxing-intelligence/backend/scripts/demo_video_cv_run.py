from __future__ import annotations

import json
import time
from pathlib import Path

import cv2

from app.analysis.person_detector import PersonDetector
from app.analysis.pose_estimation import PoseEstimator
from app.analysis.video_processor import VideoProcessor

ROOT = Path(r"C:\Users\shrey\OneDrive\Desktop\Boxing Analyzer")
VIDEO_DIR = ROOT / "demo-videos"
REPORT_DIR = ROOT / "demo-videos" / "processed-reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def main() -> None:
    detector = PersonDetector(conf_threshold=0.35)
    pose_estimator = PoseEstimator()
    videos = sorted(VIDEO_DIR.glob("*.mp4"))
    results = []
    for video_path in videos:
        started = time.perf_counter()
        processor = VideoProcessor(target_fps=2.0, max_frames=60)
        summary = processor.process_video(video_path)

        frame_count = 0
        total_detections = 0
        pose_hits = 0
        cap = cv2.VideoCapture(str(video_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 1.0
        step = max(1, int(round(fps / 2.0)))
        frame_index = 0
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            if frame_index % step != 0:
                frame_index += 1
                continue
            if frame_count >= 60:
                break
            detections = detector.detect(frame)
            total_detections += len(detections)
            if detections:
                pose_estimate = pose_estimator.estimate(frame, detections[0].box)
                if pose_estimate is not None:
                    pose_hits += 1
            frame_count += 1
            frame_index += 1
        cap.release()
        elapsed = time.perf_counter() - started
        results.append({
            "video": str(video_path.name),
            "status": "processed",
            "processing_duration_seconds": round(elapsed, 2),
            "frames_processed": summary["frames_processed"],
            "processing_fps": summary["target_fps"],
            "scene_cut_count": len(summary["scene_cuts"]),
            "detection_count": total_detections,
            "pose_hits": pose_hits,
            "quality_summary": {
                "avg_quality": round(sum(sample["quality"] for sample in summary["samples"]) / max(1, len(summary["samples"])), 4),
                "max_quality": round(max((sample["quality"] for sample in summary["samples"]), default=0.0), 4),
            },
        })

    REPORT_DIR.joinpath("demo-video-cv-status.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
