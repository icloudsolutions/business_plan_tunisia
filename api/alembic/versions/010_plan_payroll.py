"""Payroll planning: staff roles, headcount, assumptions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010_plan_payroll"
down_revision = "009_plan_product_cost_components"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_staff_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("function_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("qualification", sa.String(128), nullable=False, server_default=""),
        sa.Column("is_production_imputable", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("base_monthly_salary", sa.Float(), nullable=False, server_default="0"),
        sa.Column("annual_raise_rate_override", sa.Float(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_staff_roles_plan_id", "plan_staff_roles", ["plan_id"])

    op.create_table(
        "plan_staff_headcount",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("staff_role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plan_staff_roles.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("headcount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_plan_staff_headcount_role_year",
        "plan_staff_headcount",
        ["staff_role_id", "year"],
        unique=True,
    )

    op.create_table(
        "plan_payroll_assumptions",
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), primary_key=True),
        sa.Column("annual_raise_rate", sa.Float(), nullable=False, server_default="0.06"),
        sa.Column("cnss_employer_rate", sa.Float(), nullable=False, server_default="0.1897"),
        sa.Column("projection_cache", postgresql.JSONB(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("plan_payroll_assumptions")
    op.drop_index("ix_plan_staff_headcount_role_year", table_name="plan_staff_headcount")
    op.drop_table("plan_staff_headcount")
    op.drop_index("ix_plan_staff_roles_plan_id", table_name="plan_staff_roles")
    op.drop_table("plan_staff_roles")
