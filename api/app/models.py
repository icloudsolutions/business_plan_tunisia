import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="client")
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user",
        foreign_keys="Notification.user_id",
    )


class BusinessPlan(Base):
    __tablename__ = "business_plans"
    __table_args__ = (Index("ix_business_plans_inputs_gin", "inputs", postgresql_using="gin"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), default="Nouveau Business Plan")
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", index=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_expert_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    inputs: Mapped[dict] = mapped_column(JSONB, default=dict)
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    baseline_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    official_scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_scenarios.id"), nullable=True
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])
    simulations: Mapped[list["Simulation"]] = relationship(back_populates="plan")
    comments: Mapped[list["PlanComment"]] = relationship(back_populates="plan")
    section_reviews: Mapped[list["PlanSectionReview"]] = relationship(back_populates="plan")
    activities: Mapped[list["PlanActivity"]] = relationship(back_populates="plan")
    export_jobs: Mapped[list["ExportJob"]] = relationship(back_populates="plan")
    versions: Mapped[list["PlanVersion"]] = relationship(back_populates="plan")
    scenarios: Mapped[list["PlanScenario"]] = relationship(back_populates="plan")


class PlanScenario(Base):
    __tablename__ = "plan_scenarios"
    __table_args__ = (Index("ix_plan_scenarios_plan_id", "plan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    name: Mapped[str] = mapped_column(String(128))
    slug: Mapped[str | None] = mapped_column(String(32), nullable=True)
    multipliers: Mapped[dict] = mapped_column(JSONB, default=dict)
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    calc_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("calc_jobs.id"), nullable=True
    )
    calc_status: Mapped[str] = mapped_column(String(32), default="PENDING")
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    recommended_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    plan: Mapped["BusinessPlan"] = relationship(back_populates="scenarios")


class PlanVersion(Base):
    __tablename__ = "plan_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status_at_snapshot: Mapped[str] = mapped_column(String(32))
    inputs: Mapped[dict] = mapped_column(JSONB, nullable=False)
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str] = mapped_column(String(64))
    created_by_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["BusinessPlan"] = relationship(back_populates="versions")


class PlanAuditLog(Base):
    __tablename__ = "plan_audit_log"
    __table_args__ = (
        Index("ix_plan_audit_log_plan_id", "plan_id"),
        Index("ix_plan_audit_log_changed_at", "changed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    field_path: Mapped[str] = mapped_column(String(512))
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Simulation(Base):
    __tablename__ = "simulations"
    __table_args__ = (Index("ix_simulations_plan_id", "plan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    name: Mapped[str] = mapped_column(String(255), default="Scénario")
    patch: Mapped[dict] = mapped_column(JSONB, default=list)
    inputs: Mapped[dict] = mapped_column(JSONB, default=dict)
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    delta_vs_baseline: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["BusinessPlan"] = relationship(back_populates="simulations")


class PlanComment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_plan_id", "plan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    field_key: Mapped[str] = mapped_column(String(512))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True
    )
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["BusinessPlan"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(foreign_keys=[user_id])


class PlanSectionReview(Base):
    __tablename__ = "plan_section_reviews"
    __table_args__ = (Index("ix_plan_section_reviews_plan_id", "plan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    section_key: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    plan: Mapped["BusinessPlan"] = relationship(back_populates="section_reviews")


class PlanActivity(Base):
    __tablename__ = "plan_activities"
    __table_args__ = (Index("ix_plan_activities_plan_id", "plan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["BusinessPlan"] = relationship(back_populates="activities")


class CalcJob(Base):
    __tablename__ = "calc_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    task_type: Mapped[str] = mapped_column(String(64))
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    format: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["BusinessPlan"] = relationship(back_populates="export_jobs")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    role_target: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(16), default="in_app")
    template_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User | None"] = relationship(foreign_keys=[user_id], back_populates="notifications")


class EmailNotification(Base):
    __tablename__ = "email_notifications"
    __table_args__ = (
        Index("ix_email_notifications_plan_id", "plan_id"),
        Index("ix_email_notifications_user_id", "user_id"),
        Index("ix_email_notifications_type", "type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_plans.id"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(64))
    recipient_email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(512))
    context: Mapped[dict] = mapped_column(JSONB, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiSuggestion(Base):
    __tablename__ = "ai_suggestions"
    __table_args__ = (Index("ix_ai_suggestions_plan_id", "plan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("business_plans.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    field_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    action: Mapped[str] = mapped_column(String(32))
    user_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggestion_text: Mapped[str] = mapped_column(Text)
    suggested_value: Mapped[str | None] = mapped_column(String(128), nullable=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
