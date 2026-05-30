"""Plan loan tranches (up to 3 per plan)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "013_plan_loans"
down_revision = "012_plan_tva"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_loans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("lender_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rate", sa.Float(), nullable=False, server_default="0.083"),
        sa.Column("term_years", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("grace_months", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("frequency", sa.String(16), nullable=False, server_default="quarterly"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_loans_plan_id", "plan_loans", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_loans_plan_id", table_name="plan_loans")
    op.drop_table("plan_loans")
