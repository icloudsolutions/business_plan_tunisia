"""AI suggestion audit log

Revision ID: 004
Revises: 003
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("field_key", sa.String(512), nullable=True),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("user_message", sa.Text(), nullable=True),
        sa.Column("suggestion_text", sa.Text(), nullable=False),
        sa.Column("suggested_value", sa.String(128), nullable=True),
        sa.Column("accepted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ai_suggestions_plan_id", "ai_suggestions", ["plan_id"])


def downgrade() -> None:
    op.drop_table("ai_suggestions")
