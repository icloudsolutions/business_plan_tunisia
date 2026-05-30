"""Financing sources and structure validation."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "016_plan_financing_sources"
down_revision = "015_plan_procurement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_financing_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False, server_default="fonds_propres"),
        sa.Column("label", sa.String(255), nullable=False, server_default=""),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("term_years", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("grace_months", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "loan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plan_loans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_financing_sources_plan_id", "plan_financing_sources", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_financing_sources_plan_id", table_name="plan_financing_sources")
    op.drop_table("plan_financing_sources")
