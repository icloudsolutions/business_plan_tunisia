"""Plan implementation timeline (Gantt phases)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014_plan_timeline"
down_revision = "013_plan_loans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_timeline_settings",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), primary_key=True),
        sa.Column("plan_start_date", sa.Date(), nullable=False),
        sa.Column("startup_delay_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("horizon_months", sa.Integer(), nullable=False, server_default="18"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "plan_timeline_phases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("phase_type", sa.String(32), nullable=False, server_default="investment"),
        sa.Column("color", sa.String(16), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_timeline_phases_plan_id", "plan_timeline_phases", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_timeline_phases_plan_id", table_name="plan_timeline_phases")
    op.drop_table("plan_timeline_phases")
    op.drop_table("plan_timeline_settings")
