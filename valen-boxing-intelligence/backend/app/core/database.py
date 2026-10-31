from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from typing import Generator

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
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
