import subprocess
import json
from pathlib import Path
from dataclasses import dataclass

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False


class MetadataExtractionError(Exception):
    pass


@dataclass
class VideoMetadata:
    duration: float
    width: int
    height: int
    fps: float
    frame_count: int


def _extract_with_ffprobe(file_path: Path) -> VideoMetadata:
    """Extract metadata using ffprobe (preferred)."""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", str(file_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")

    data = json.loads(result.stdout)
    video_stream = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
        None,
    )
    if not video_stream:
        raise RuntimeError("No video stream found")

    duration = float(data.get("format", {}).get("duration", 0))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    fps_str = video_stream.get("r_frame_rate", "0/1")
    try:
        num, den = fps_str.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 0.0
    except Exception:
        fps = 0.0

    frame_count = int(video_stream.get("nb_frames", 0))
    if frame_count == 0 and duration > 0 and fps > 0:
        frame_count = int(duration * fps)

    if not all([duration > 0, width > 0, height > 0, fps > 0, frame_count > 0]):
        raise RuntimeError("ffprobe returned incomplete metadata")

    return VideoMetadata(duration=duration, width=width, height=height, fps=fps, frame_count=frame_count)


def _extract_with_opencv(file_path: Path) -> VideoMetadata:
    """Extract metadata using OpenCV (fallback)."""
    if not CV2_AVAILABLE:
        raise RuntimeError("OpenCV not available")

    cap = cv2.VideoCapture(str(file_path))
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV could not open: {file_path}")

    try:
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0.0
    finally:
        cap.release()

    if not all([duration > 0, width > 0, height > 0, fps > 0, frame_count > 0]):
        raise RuntimeError("OpenCV returned incomplete metadata")

    return VideoMetadata(duration=duration, width=width, height=height, fps=fps, frame_count=frame_count)


def check_ffmpeg() -> bool:
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def extract_video_metadata(file_path: Path) -> VideoMetadata:
    """Extract metadata, preferring FFmpeg, falling back to OpenCV."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        return _extract_with_ffprobe(file_path)
    except Exception as ffmpeg_err:
        logger.warning("FFmpeg metadata extraction failed (%s), falling back to OpenCV", ffmpeg_err)

    try:
        return _extract_with_opencv(file_path)
    except Exception as cv_err:
        raise MetadataExtractionError(
            f"Both FFmpeg and OpenCV failed to extract metadata. "
            f"FFmpeg: {ffmpeg_err}. OpenCV: {cv_err}."
        )
