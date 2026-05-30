"""Collaboration: comments threads, section reviews, activity feed

Revision ID: 002
Revises: 001
Create Date: 2026-05-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("field_key", sa.String(512), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("comments.id"), nullable=True),
        sa.Column("resolved", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_comments_plan_id", "comments", ["plan_id"])
    op.create_index("ix_comments_parent_id", "comments", ["parent_id"])

    # Migrate legacy expert_comments if present
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "expert_comments" in inspector.get_table_names():
        op.execute(
            """
            INSERT INTO comments (id, plan_id, field_key, user_id, content, parent_id, resolved, created_at)
            SELECT id, plan_id, field_path, author_id, body, NULL, resolved, created_at
            FROM expert_comments
            """
        )
        op.drop_index("ix_expert_comments_plan_id", table_name="expert_comments")
        op.drop_table("expert_comments")

    op.create_table(
        "plan_section_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("section_key", sa.String(64), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("plan_id", "section_key", name="uq_plan_section_review"),
    )
    op.create_index("ix_plan_section_reviews_plan_id", "plan_section_reviews", ["plan_id"])

    op.create_table(
        "plan_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_plan_activities_plan_id", "plan_activities", ["plan_id"])


def downgrade() -> None:
    op.drop_table("plan_activities")
    op.drop_table("plan_section_reviews")
    op.drop_table("comments")
    op.create_table(
        "expert_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("business_plans.id")),
        sa.Column("field_path", sa.String(512)),
        sa.Column("body", sa.Text()),
        sa.Column("resolved", sa.Boolean(), server_default=sa.false()),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
