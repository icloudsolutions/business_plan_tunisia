"""Operating expenses (Autres charges) config and settings."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011_plan_other_charges"
down_revision = "010_plan_payroll"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_other_charges_settings",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), primary_key=True),
        sa.Column("lf2012_exemption_5y", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("projection_cache", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "plan_other_charges_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("rule_type", sa.String(32), nullable=False),
        sa.Column("base_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rate_or_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("inflation_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_other_charges_plan_id", "plan_other_charges_config", ["plan_id"])
    op.create_index(
        "ix_plan_other_charges_plan_category",
        "plan_other_charges_config",
        ["plan_id", "category"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_plan_other_charges_plan_category", table_name="plan_other_charges_config")
    op.drop_index("ix_plan_other_charges_plan_id", table_name="plan_other_charges_config")
    op.drop_table("plan_other_charges_config")
    op.drop_table("plan_other_charges_settings")
