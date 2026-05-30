"""Plan products and revenue assumptions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008_plan_products_revenue"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("unit", sa.String(32), nullable=False, server_default="unit"),
        sa.Column("unit_price_sell", sa.Float(), nullable=False, server_default="0"),
        sa.Column("ristourne_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("monthly_qty_y1", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_products_plan_id", "plan_products", ["plan_id"])

    op.create_table(
        "plan_revenue_assumptions",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), primary_key=True),
        sa.Column("nominal_capacity", sa.Float(), nullable=False, server_default="0"),
        sa.Column("capacity_basis", sa.String(32), nullable=False, server_default="units_per_day"),
        sa.Column("production_days", sa.Float(), nullable=False, server_default="250"),
        sa.Column("growth_rate_y2", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("growth_rate_y3", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("growth_rate_y4", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("growth_rate_y5", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("growth_rate_y6", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("growth_rate_y7", sa.Float(), nullable=False, server_default="0.15"),
        sa.Column("projection_cache", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("plan_revenue_assumptions")
    op.drop_index("ix_plan_products_plan_id", table_name="plan_products")
    op.drop_table("plan_products")
