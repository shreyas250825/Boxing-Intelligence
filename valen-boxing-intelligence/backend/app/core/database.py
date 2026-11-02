from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_dir(url: str) -> None:
    """Create the parent directory for a SQLite file before the engine opens it.

    urlparse("sqlite:///./data/foo.db").path returns "/./data/foo.db" — the
    leading "/" makes Path.is_absolute() return True on POSIX, silently
    skipping the cwd-join branch.  Strip the leading "/" first, then decide
    relative vs absolute from the *original* URL string.
    """
    parsed = urlparse(url)
    if parsed.scheme != "sqlite":
        return
    raw_path = parsed.path          # e.g. "/./data/foo.db"  or  "/tmp/foo.db"
    if raw_path in ("", ":memory:"):
        return

    # Strip the "/" that urlparse always prepends to the path component.
    stripped = raw_path.lstrip("/")  # "./data/foo.db"  or  "tmp/foo.db"

    if stripped.startswith("."):
        # Relative URL (sqlite:///./...) — resolve against working directory.
        db_path = Path.cwd() / stripped
    else:
        # Absolute URL (sqlite:////tmp/...) — restore the leading slash.
        db_path = Path("/" + stripped)

    db_path.parent.mkdir(parents=True, exist_ok=True)


def _make_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        _ensure_sqlite_dir(url)
        _engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(_engine, "connect")
        def set_sqlite_pragmas(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return _engine
    else:
        return create_engine(url)


engine = _make_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_analysis_columns() -> None:
    """Add columns on existing databases; create_all does not ALTER tables."""
    dialect = engine.dialect.name
    extras = [
        ("tracking_json", "TEXT"),
        ("report_json", "TEXT"),
        ("report_status", "VARCHAR(20)"),
        ("completed_at", "DATETIME"),
    ]
    with engine.begin() as conn:
        if dialect == "sqlite":
            rows = conn.execute(text("PRAGMA table_info(browser_video_analyses)")).fetchall()
            if not rows:
                return
            names = {row[1] for row in rows}
            for col, typ in extras:
                if col not in names:
                    conn.execute(text(f"ALTER TABLE browser_video_analyses ADD COLUMN {col} {typ}"))
        elif dialect == "postgresql":
            conn.execute(text(
                "ALTER TABLE IF EXISTS browser_video_analyses "
                "ADD COLUMN IF NOT EXISTS tracking_json TEXT"
            ))
            conn.execute(text(
                "ALTER TABLE IF EXISTS browser_video_analyses "
                "ADD COLUMN IF NOT EXISTS report_json TEXT"
            ))
            conn.execute(text(
                "ALTER TABLE IF EXISTS browser_video_analyses "
                "ADD COLUMN IF NOT EXISTS report_status VARCHAR(20)"
            ))
            conn.execute(text(
                "ALTER TABLE IF EXISTS browser_video_analyses "
                "ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP"
            ))


def init_db() -> None:
    """Create all tables idempotently. Safe to call multiple times on Render startup."""
    Base.metadata.create_all(bind=engine)
    _ensure_analysis_columns()