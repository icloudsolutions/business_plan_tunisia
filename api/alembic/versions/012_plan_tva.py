"""TVA reconciliation config and settings."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012_plan_tva"
down_revision = "011_plan_other_charges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_tva_settings",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), primary_key=True),
        sa.Column("carton_share_of_packaging", sa.Float(), nullable=False, server_default="0.35"),
        sa.Column("projection_cache", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "plan_tva_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("applies_to", sa.String(64), nullable=False),
        sa.Column("label", sa.String(255), nullable=False, server_default=""),
        sa.Column("tva_rate_purchase", sa.Float(), nullable=False, server_default="0.18"),
        sa.Column("tva_rate_sales", sa.Float(), nullable=False, server_default="0.18"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_tva_config_plan_id", "plan_tva_config", ["plan_id"])
    op.create_index(
        "ix_plan_tva_config_plan_applies",
        "plan_tva_config",
        ["plan_id", "category", "applies_to"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_plan_tva_config_plan_applies", table_name="plan_tva_config")
    op.drop_index("ix_plan_tva_config_plan_id", table_name="plan_tva_config")
    op.drop_table("plan_tva_config")
    op.drop_table("plan_tva_settings")
