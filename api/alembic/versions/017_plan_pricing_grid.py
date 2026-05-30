"""Pricing grid per product (buy/sell vs market)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "017_plan_pricing_grid"
down_revision = "016_plan_financing_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_pricing_grid",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plan_products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purchase_price_per_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sell_price_per_unit", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sell_price_per_kg", sa.Float(), nullable=False, server_default="0"),
        sa.Column("market_retail_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("ristourne_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit_weight_g", sa.Float(), nullable=False, server_default="1000"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_pricing_grid_plan_id", "plan_pricing_grid", ["plan_id"])
    op.create_index(
        "ix_plan_pricing_grid_product_unique",
        "plan_pricing_grid",
        ["plan_id", "product_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_plan_pricing_grid_product_unique", table_name="plan_pricing_grid")
    op.drop_index("ix_plan_pricing_grid_plan_id", table_name="plan_pricing_grid")
    op.drop_table("plan_pricing_grid")
