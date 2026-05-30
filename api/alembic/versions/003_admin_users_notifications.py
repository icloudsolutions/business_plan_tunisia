"""Admin: user status, last_active, notifications

Revision ID: 003
Revises: 002
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("status", sa.String(16), server_default="active", nullable=False),
    )
    op.add_column("users", sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("role_target", sa.String(32), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(16), server_default="in_app"),
        sa.Column("template_key", sa.String(64), nullable=True),
        sa.Column("read", sa.Boolean(), server_default=sa.false()),
        sa.Column("email_sent", sa.Boolean(), server_default=sa.false()),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_column("users", "last_active_at")
    op.drop_column("users", "status")
    op.drop_column("users", "display_name")
