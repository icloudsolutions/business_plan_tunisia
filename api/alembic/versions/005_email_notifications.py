"""Email notification audit log

Revision ID: 005
Revises: 004
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(512), nullable=False),
        sa.Column("context", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_email_notifications_plan_id", "email_notifications", ["plan_id"])
    op.create_index("ix_email_notifications_user_id", "email_notifications", ["user_id"])
    op.create_index("ix_email_notifications_type", "email_notifications", ["type"])
    op.create_index("ix_email_notifications_sent_at", "email_notifications", ["sent_at"])


def downgrade() -> None:
    op.drop_table("email_notifications")
