"""add report_json to browser_video_analyses

Revision ID: c4f8a2b9d0e1
Revises: b7c21e90a1f4
Create Date: 2026-10-31 16:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4f8a2b9d0e1"
down_revision: Union[str, Sequence[str], None] = "b7c21e90a1f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "browser_video_analyses" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("browser_video_analyses")}
    if "report_json" not in cols:
        op.add_column("browser_video_analyses", sa.Column("report_json", sa.Text(), nullable=True))
    if "report_status" not in cols:
        op.add_column("browser_video_analyses", sa.Column("report_status", sa.String(length=20), nullable=True))
    if "completed_at" not in cols:
        op.add_column("browser_video_analyses", sa.Column("completed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "browser_video_analyses" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("browser_video_analyses")}
    for col in ("completed_at", "report_status", "report_json"):
        if col in cols:
            op.drop_column("browser_video_analyses", col)
