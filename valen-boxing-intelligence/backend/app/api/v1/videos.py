from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pathlib import Path
from typing import Optional

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
    content = await file.read()

    if len(content) > video_service.settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=error_response(
                "VIDEO_FILE_TOO_LARGE",
                f"Upload exceeds maximum size of {video_service.settings.MAX_UPLOAD_BYTES} bytes.",
            )["error"],
        )

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

    try:
        video = video_service.save_upload(
            db=db,
            file_content=content,
            original_filename=file.filename or "upload.mp4",
            content_type=file.content_type or "video/mp4",
            boxer_id=boxer_id,
            session_id=session.id,
        )
    except VideoValidationError as e:
        db.delete(session)
        db.commit()
        status_code = 413 if e.code == "VIDEO_FILE_TOO_LARGE" else 422
        raise HTTPException(
            status_code=status_code,
            detail=error_response(e.code, e.message)["error"],
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