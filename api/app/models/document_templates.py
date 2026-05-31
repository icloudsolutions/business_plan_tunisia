"""Modèles ORM pour les templates de documents (Excel, Word, PowerPoint)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DocumentTemplate(Base):
    __tablename__ = "document_templates"
    __table_args__ = (
        Index("ix_document_templates_secteur", "secteur"),
        Index("ix_document_templates_active", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    version: Mapped[str] = mapped_column(String(32), default="v1.0")
    secteur: Mapped[str] = mapped_column(String(64))
    sous_secteur: Mapped[str] = mapped_column(String(64))
    type_entreprise: Mapped[str] = mapped_column(String(16))
    type_financement: Mapped[str] = mapped_column(String(32))
    document_type: Mapped[str] = mapped_column(String(16), default="ALL")
    hypotheses: Mapped[dict] = mapped_column(JSONB, default=dict)
    sections_incluses: Mapped[list] = mapped_column(JSONB, default=list)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])
    hypothesis_rows: Mapped[list["TemplateHypothese"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class TemplateHypothese(Base):
    __tablename__ = "template_hypotheses"
    __table_args__ = (Index("ix_template_hypotheses_template_id", "template_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_templates.id", ondelete="CASCADE")
    )
    categorie: Mapped[str] = mapped_column(String(32))
    cle: Mapped[str] = mapped_column(String(80))
    valeur_defaut: Mapped[float] = mapped_column()
    unite: Mapped[str] = mapped_column(String(16), default="%")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_valeur: Mapped[float | None] = mapped_column(nullable=True)
    max_valeur: Mapped[float | None] = mapped_column(nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)

    template: Mapped["DocumentTemplate"] = relationship(back_populates="hypothesis_rows")
