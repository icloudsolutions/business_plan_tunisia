"""Per-product cost components."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009_plan_product_cost_components"
down_revision = "008_plan_products_revenue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_product_cost_components",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plan_products.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("mp_price_per_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("arome_rate_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("packaging_g_per_unit", sa.Float(), nullable=False, server_default="1000"),
        sa.Column("packaging_price_per_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("gas_monthly", sa.Float(), nullable=False, server_default="0"),
        sa.Column("electricity_monthly", sa.Float(), nullable=False, server_default="0"),
        sa.Column("water_monthly", sa.Float(), nullable=False, server_default="0"),
        sa.Column("waste_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_cost_plan_id", "plan_product_cost_components", ["plan_id"])
    op.create_index(
        "ix_plan_cost_product_year",
        "plan_product_cost_components",
        ["plan_id", "product_id", "year"],
        unique=True,
    )
    op.add_column(
        "plan_revenue_assumptions",
        sa.Column("margin_alert_threshold", sa.Float(), nullable=False, server_default="0.2"),
    )


def downgrade() -> None:
    op.drop_column("plan_revenue_assumptions", "margin_alert_threshold")
    op.drop_index("ix_plan_cost_product_year", table_name="plan_product_cost_components")
    op.drop_index("ix_plan_cost_plan_id", table_name="plan_product_cost_components")
    op.drop_table("plan_product_cost_components")
