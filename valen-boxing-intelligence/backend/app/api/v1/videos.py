from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Optional
import aiofiles
import time

from app.core.database import get_db
from app.core.config import settings
from app.core.responses import success_response, error_response
from app.schemas.video import VideoResponse, VideoUploadResponse
from app.schemas.training_session import TrainingSessionCreate
from app.services import video_service
from app.services.video_service import VideoValidationError, VideoNotFoundError
import app.services.training_session_service as ts_service

router = APIRouter(tags=["videos"])


def video_cors_headers(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin") or ""
    allowed = settings.cors_origins_list
    vercel = origin.endswith(".vercel.app") and origin.startswith("https://")
    local = origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:")
    if origin and (origin in allowed or vercel or local):
        acao = origin
    elif allowed:
        acao = allowed[0]
    else:
        acao = "*"
    return {
        "Access-Control-Allow-Origin": acao,
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Origin, Accept",
        "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Vary": "Origin",
    }


@router.post("/videos/upload", status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    boxer_id: str = Form(...),
    fight_camp_id: Optional[str] = Form(None),
    session_type: str = Form("other"),
    session_date: str = Form(...),
    rounds: Optional[int] = Form(None),
    objectives: Optional[str] = Form(None),
    coach_notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload a video file.

    Performance notes:
    - Streams the file to disk in 256 KB chunks — never holds the full file in RAM.
    - Validates size progressively during streaming.
    - Returns immediately after the file is safely on disk.
    - CV processing is kicked off asynchronously via the /analyse endpoint
      and does NOT happen during this request.
    """
    t0 = time.perf_counter()

    # Validate extension before reading any data
    ext = video_service.get_extension(file.filename or "upload.mp4")
    try:
        video_service.validate_file_extension(file.filename or "upload.mp4")
    except VideoValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=error_response(e.code, e.message)["error"],
        )

    # Create training session first (lightweight DB op)
    session_data = TrainingSessionCreate(
        boxer_id=boxer_id,
        fight_camp_id=fight_camp_id,
        session_type=session_type,
        session_date=session_date,
        rounds=rounds,
        objectives=objectives,
        coach_notes=coach_notes,
    )
    try:
        session = ts_service.create_training_session(db, session_data)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=error_response("SESSION_CREATE_FAILED", str(e))["error"],
        )

    # Stream file to disk in chunks — avoids loading 2 GB into memory
    import uuid
    video_id = str(uuid.uuid4())
    storage_dir = video_service.get_storage_dir()
    safe_path = video_service.build_safe_path(storage_dir, video_id, ext)

    bytes_written = 0
    CHUNK_SIZE = 256 * 1024  # 256 KB

    try:
        async with aiofiles.open(safe_path, "wb") as out:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > settings.MAX_UPLOAD_BYTES:
                    await out.close()
                    safe_path.unlink(missing_ok=True)
                    db.delete(session)
                    db.commit()
                    raise HTTPException(
                        status_code=413,
                        detail=error_response(
                            "VIDEO_FILE_TOO_LARGE",
                            f"Upload exceeds maximum size of {settings.MAX_UPLOAD_BYTES} bytes.",
                        )["error"],
                    )
                await out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        safe_path.unlink(missing_ok=True)
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=error_response("VIDEO_STORAGE_FAILURE", f"Failed to write video: {e}")["error"],
        )

    # Validate MIME only after we know the extension (already done above via validate_file_extension)
    from app.services.video_service import MIME_MAP
    mime = MIME_MAP.get(ext, file.content_type or "video/mp4")

    # Safe original filename (display only)
    from app.models.video import Video as VideoModel
    safe_original = Path(file.filename or "upload.mp4").name[:500]

    video = VideoModel(
        id=video_id,
        boxer_id=boxer_id,
        session_id=session.id,
        storage_filename=safe_path.name,
        original_filename_safe=safe_original,
        mime_type=mime,
        file_size_bytes=bytes_written,
        status="uploaded",
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    elapsed = time.perf_counter() - t0

    import logging
    logging.getLogger(__name__).info(
        "Video upload complete: %s, %d bytes, %.2fs",
        video_id, bytes_written, elapsed,
    )

    return success_response(
        VideoUploadResponse(
            video_id=video.id,
            session_id=session.id,
            status=video.status,
            original_filename_safe=video.original_filename_safe,
            file_size_bytes=video.file_size_bytes,
            uploaded_at=video.uploaded_at,
        ).model_dump()
    )


@router.get("/videos/{video_id}")
def get_video(video_id: str, db: Session = Depends(get_db)):
    video = video_service.get_video(db, video_id)
    if not video:
        raise HTTPException(
            status_code=404,
            detail=error_response("VIDEO_NOT_FOUND", "Video not found")["error"],
        )
    return success_response(VideoResponse.model_validate(video).model_dump())


@router.options("/videos/{video_id}/stream")
def stream_video_preflight(request: Request):
    return Response(status_code=204, headers=video_cors_headers(request))


@router.get("/videos/{video_id}/stream")
def stream_video(video_id: str, request: Request, db: Session = Depends(get_db)):
    """Stream video file with range request support for HTML5 video player."""
    video = video_service.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail=error_response("VIDEO_NOT_FOUND", "Video not found")["error"])

    storage_dir = Path(settings.STORAGE_DIR).resolve()
    file_path = (storage_dir / video.storage_filename).resolve(strict=False)
    try:
        file_path.relative_to(storage_dir)
    except ValueError:
        raise HTTPException(status_code=404, detail=error_response("VIDEO_FILE_NOT_FOUND", "Video file not found on disk")["error"])

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=error_response("VIDEO_FILE_NOT_FOUND", "Video file not found on disk")["error"])

    file_size = file_path.stat().st_size
    mime = video.mime_type or "video/mp4"

    # Handle Range requests (required for HTML5 video seeking)
    range_header = request.headers.get("range")
    if range_header:
        try:
            range_val = range_header.replace("bytes=", "")
            start_str, end_str = range_val.split("-")
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
        except Exception:
            start, end = 0, file_size - 1

        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_range():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            **video_cors_headers(request),
        }
        return StreamingResponse(
            iter_range(),
            status_code=206,
            media_type=mime,
            headers=headers,
        )

    # Full file response
    def iter_file():
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type=mime,
        headers={
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
            **video_cors_headers(request),
        },
    )


@router.delete("/videos/{video_id}", status_code=204)
def delete_video(video_id: str, db: Session = Depends(get_db)):
    try:
        video_service.delete_video(db, video_id)
    except VideoNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=error_response("VIDEO_NOT_FOUND", "Video not found")["error"],
        )


@router.get("/videos/{video_id}/thumbnail")
def get_video_thumbnail(video_id: str, t: float = 1.0, db: Session = Depends(get_db)):
    """Extract a single frame at timestamp t (seconds) and return as JPEG base64."""
    import base64
    video = video_service.get_video(db, video_id)
    if not video:
        raise HTTPException(status_code=404, detail=error_response("VIDEO_NOT_FOUND", "Video not found")["error"])

    storage_dir = Path(settings.STORAGE_DIR)
    file_path = storage_dir / video.storage_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=error_response("FILE_NOT_FOUND", "Video file not found on disk")["error"])

    try:
        import cv2
        cap = cv2.VideoCapture(str(file_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        target_frame = int(t * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        success, frame = cap.read()
        cap.release()
        if not success or frame is None:
            # Try frame 0
            cap = cv2.VideoCapture(str(file_path))
            success, frame = cap.read()
            cap.release()
        if success and frame is not None:
            # Scale down to max 640px wide
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / w
                frame = cv2.resize(frame, (640, int(h * scale)))
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            b64 = base64.b64encode(buf.tobytes()).decode()
            return success_response({
                "data_url": f"data:image/jpeg;base64,{b64}",
                "width": frame.shape[1],
                "height": frame.shape[0],
                "timestamp": t,
            })
    except Exception as e:
        pass

    raise HTTPException(status_code=422, detail=error_response("FRAME_EXTRACT_FAILED", "Could not extract frame from video")["error"])