"""Plan field audit log + version snapshot JSONB

Revision ID: 007
Revises: 006
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "plan_versions",
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_table(
        "plan_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("field_path", sa.String(512), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_audit_log_plan_id", "plan_audit_log", ["plan_id"])
    op.create_index("ix_plan_audit_log_changed_at", "plan_audit_log", ["changed_at"])
    op.create_index("ix_plan_audit_log_plan_changed", "plan_audit_log", ["plan_id", "changed_at"])


def downgrade() -> None:
    op.drop_table("plan_audit_log")
    op.drop_column("plan_versions", "snapshot")
