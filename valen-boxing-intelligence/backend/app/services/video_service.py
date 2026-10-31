import uuid
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.video import Video

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}
MIME_MAP = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
}


class VideoValidationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class VideoNotFoundError(Exception):
    pass


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def validate_file_extension(filename: str) -> str:
    ext = get_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise VideoValidationError(
            "VIDEO_INVALID_TYPE",
            f"File type '{ext}' not accepted. Accepted: {sorted(ALLOWED_EXTENSIONS)}",
        )
    return ext


def validate_mime_type(content_type: str, extension: str) -> None:
    expected = MIME_MAP.get(extension)
    if expected and content_type and content_type.split(";")[0].strip() != expected:
        raise VideoValidationError(
            "VIDEO_INVALID_TYPE",
            f"MIME type '{content_type}' does not match extension '{extension}'. Expected '{expected}'.",
        )


def build_safe_path(storage_dir: Path, video_id: str, extension: str) -> Path:
    """Build a safe path using UUID + whitelisted extension only."""
    assert extension in ALLOWED_EXTENSIONS, f"Extension {extension} not in allowlist"
    path = storage_dir / f"{video_id}{extension}"
    assert path.parent.resolve() == storage_dir.resolve(), "Path traversal detected"
    return path


def get_storage_dir() -> Path:
    storage = Path(settings.STORAGE_DIR)
    storage.mkdir(parents=True, exist_ok=True)
    return storage


def save_upload(
    db: Session,
    file_content: bytes,
    original_filename: str,
    content_type: str,
    boxer_id: str,
    session_id: Optional[str] = None,
) -> Video:
    ext = validate_file_extension(original_filename)
    validate_mime_type(content_type, ext)

    file_size = len(file_content)
    if file_size > settings.MAX_UPLOAD_BYTES:
        raise VideoValidationError(
            "VIDEO_FILE_TOO_LARGE",
            f"File size {file_size} exceeds maximum {settings.MAX_UPLOAD_BYTES} bytes.",
        )

    video_id = str(uuid.uuid4())
    storage_dir = get_storage_dir()
    safe_path = build_safe_path(storage_dir, video_id, ext)

    # Write file
    try:
        safe_path.write_bytes(file_content)
    except Exception as e:
        safe_path.unlink(missing_ok=True)
        raise VideoValidationError("VIDEO_STORAGE_FAILURE", f"Failed to write video: {e}")

    # Safe original filename (display only)
    safe_original = Path(original_filename).name[:500]

    video = Video(
        id=video_id,
        boxer_id=boxer_id,
        session_id=session_id,
        storage_filename=safe_path.name,
        original_filename_safe=safe_original,
        mime_type=MIME_MAP.get(ext, content_type),
        file_size_bytes=file_size,
        status="uploaded",
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


def get_video(db: Session, video_id: str) -> Optional[Video]:
    return db.query(Video).filter(Video.id == video_id).first()


def delete_video(db: Session, video_id: str) -> None:
    video = get_video(db, video_id)
    if not video:
        raise VideoNotFoundError(video_id)

    storage_dir = get_storage_dir()
    file_path = storage_dir / video.storage_filename
    if file_path.exists():
        file_path.unlink()

    db.delete(video)
    db.commit()
