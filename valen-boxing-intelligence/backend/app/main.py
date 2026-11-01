import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.responses import global_exception_handler
from app.core.database import init_db
from app.api.v1.auth import router as auth_router
from app.api.v1.boxers import router as boxers_router
from app.api.v1.fight_camps import router as fight_camps_router
from app.api.v1.videos import router as videos_router
from app.api.v1.analysis import router as analysis_router
from app.api.v1.observations import router as observations_router
from app.api.v1.progress import router as progress_router
from app.api.v1.reports import router as reports_router
from app.api.v1.browser_analysis import router as browser_analysis_router
import app.models  # noqa: F401


def check_ffmpeg() -> bool:
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


app = FastAPI(
    title="Valen Boxing Intelligence",
    description="Video-based boxing performance analysis platform by Valen Labs",
    version="2.0.0",
)

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

app.add_exception_handler(Exception, global_exception_handler)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "ffmpeg_available": check_ffmpeg(),
        "version": "2.0.0",
    }


API_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(boxers_router, prefix=API_PREFIX)
app.include_router(fight_camps_router, prefix=API_PREFIX)
app.include_router(videos_router, prefix=API_PREFIX)
app.include_router(analysis_router, prefix=API_PREFIX)
app.include_router(observations_router, prefix=API_PREFIX)
app.include_router(progress_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(browser_analysis_router, prefix=API_PREFIX)