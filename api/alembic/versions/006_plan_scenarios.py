"""Plan scenarios (pessimiste / base / optimiste + custom)

Revision ID: 006
Revises: 005
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "business_plans",
        sa.Column("official_scenario_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_table(
        "plan_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("slug", sa.String(32), nullable=True),
        sa.Column("multipliers", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("results", postgresql.JSONB, nullable=True),
        sa.Column("calc_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("calc_jobs.id"), nullable=True),
        sa.Column("calc_status", sa.String(32), server_default="PENDING"),
        sa.Column("is_official", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("recommended_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_scenarios_plan_id", "plan_scenarios", ["plan_id"])
    op.create_foreign_key(
        "fk_business_plans_official_scenario",
        "business_plans",
        "plan_scenarios",
        ["official_scenario_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_business_plans_official_scenario", "business_plans", type_="foreignkey")
    op.drop_column("business_plans", "official_scenario_id")
    op.drop_table("plan_scenarios")
