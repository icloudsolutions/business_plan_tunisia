"""Raw materials, recipes, procurement assumptions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015_plan_procurement"
down_revision = "014_plan_timeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_raw_materials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("unit", sa.String(32), nullable=False, server_default="kg"),
        sa.Column("category", sa.String(32), nullable=False, server_default="mp"),
        sa.Column("price_per_unit", sa.Float(), nullable=False, server_default="0"),
        sa.Column("supplier_payment_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("tva_rate", sa.Float(), nullable=False, server_default="0.18"),
        sa.Column("annual_price_inflation_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_raw_materials_plan_id", "plan_raw_materials", ["plan_id"])

    op.create_table(
        "plan_product_recipes",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plan_products.id"), nullable=False),
        sa.Column(
            "raw_material_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plan_raw_materials.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quantity_per_kg_product", sa.Float(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("product_id", "raw_material_id"),
    )

    op.create_table(
        "plan_purchase_assumptions",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column(
            "raw_material_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("plan_raw_materials.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stock_days", sa.Integer(), nullable=False, server_default="30"),
        sa.PrimaryKeyConstraint("plan_id", "raw_material_id"),
    )


def downgrade() -> None:
    op.drop_table("plan_purchase_assumptions")
    op.drop_table("plan_product_recipes")
    op.drop_index("ix_plan_raw_materials_plan_id", table_name="plan_raw_materials")
    op.drop_table("plan_raw_materials")
