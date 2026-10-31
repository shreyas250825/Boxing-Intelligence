from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool


def test_tracking_json_added_to_existing_sqlite_table():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE browser_video_analyses (
                id VARCHAR(36) PRIMARY KEY,
                video_id VARCHAR(36) NOT NULL
            )
            """
        ))
        names = {row[1] for row in conn.execute(text("PRAGMA table_info(browser_video_analyses)")).fetchall()}
        assert "tracking_json" not in names
        conn.execute(text("ALTER TABLE browser_video_analyses ADD COLUMN tracking_json TEXT"))
        names = {row[1] for row in conn.execute(text("PRAGMA table_info(browser_video_analyses)")).fetchall()}
        assert "tracking_json" in names
        conn.execute(text(
            "INSERT INTO browser_video_analyses (id, video_id, tracking_json) "
            "VALUES ('1', 'v', '{\"boxers\":[]}')"
        ))
        row = conn.execute(text("SELECT tracking_json FROM browser_video_analyses WHERE id='1'")).fetchone()
        assert '"boxers"' in row[0]


def test_report_columns_added_to_existing_sqlite_table():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE browser_video_analyses (
                id VARCHAR(36) PRIMARY KEY,
                video_id VARCHAR(36) NOT NULL,
                tracking_json TEXT
            )
            """
        ))
        names = {row[1] for row in conn.execute(text("PRAGMA table_info(browser_video_analyses)")).fetchall()}
        assert "report_json" not in names
        conn.execute(text("ALTER TABLE browser_video_analyses ADD COLUMN report_json TEXT"))
        conn.execute(text("ALTER TABLE browser_video_analyses ADD COLUMN report_status VARCHAR(20)"))
        conn.execute(text("ALTER TABLE browser_video_analyses ADD COLUMN completed_at DATETIME"))
        names = {row[1] for row in conn.execute(text("PRAGMA table_info(browser_video_analyses)")).fetchall()}
        assert "report_json" in names
        assert "report_status" in names
        conn.execute(text(
            "INSERT INTO browser_video_analyses (id, video_id, report_json, report_status) "
            "VALUES ('1', 'v', '{\"title\":\"Boxing Performance Report\"}', 'complete')"
        ))
        row = conn.execute(text("SELECT report_status FROM browser_video_analyses WHERE id='1'")).fetchone()
        assert row[0] == "complete"
