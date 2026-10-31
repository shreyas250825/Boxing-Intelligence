"""add tracking_json to browser_video_analyses

Revision ID: b7c21e90a1f4
Revises: 38d104466227
Create Date: 2026-10-31 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c21e90a1f4"
down_revision: Union[str, Sequence[str], None] = "38d104466227"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if "browser_video_analyses" not in tables:
        op.create_table(
            "browser_video_analyses",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("video_id", sa.String(length=36), nullable=False),
            sa.Column("boxer_id", sa.String(length=36), nullable=False),
            sa.Column("fight_camp_id", sa.String(length=36), nullable=True),
            sa.Column("average_visual_activity", sa.Float(), nullable=True),
            sa.Column("peak_visual_activity", sa.Float(), nullable=True),
            sa.Column("processed_frames", sa.Integer(), nullable=False),
            sa.Column("duration_seconds", sa.Float(), nullable=True),
            sa.Column("activity_series_json", sa.Text(), nullable=True),
            sa.Column("activity_bursts_json", sa.Text(), nullable=True),
            sa.Column("action_events_json", sa.Text(), nullable=True),
            sa.Column("roi_config_json", sa.Text(), nullable=True),
            sa.Column("round_config_json", sa.Text(), nullable=True),
            sa.Column("coach_summary_json", sa.Text(), nullable=True),
            sa.Column("tracking_json", sa.Text(), nullable=True),
            sa.Column("methodology_version", sa.String(length=20), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["boxer_id"], ["boxers.id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["fight_camp_id"], ["fight_camps.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("video_id"),
        )
        return
    cols = {c["name"] for c in inspector.get_columns("browser_video_analyses")}
    if "tracking_json" not in cols:
        op.add_column("browser_video_analyses", sa.Column("tracking_json", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "browser_video_analyses" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("browser_video_analyses")}
        if "tracking_json" in cols:
            op.drop_column("browser_video_analyses", "tracking_json")
