"""API templates documentaires (secteur, hypothèses, instanciation)."""

from __future__ import annotations

import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bp_schema.enums import BusinessPlanStatus
from bp_schema.templates import list_taxonomy

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models import DocumentTemplate, TemplateHypothese, User
from app.scenario_services import ensure_default_scenarios
from app.schemas import (
    AdminTemplateCreate,
    AdminTemplateUpdate,
    PlanFromTemplateRequest,
    PlanFromTemplateResponse,
    SavePlanAsTemplateRequest,
    TemplateDetail,
    TemplateSummary,
)
from app.template_services import (
    build_inputs_from_hypotheses,
    extract_hypotheses_from_plan,
    sync_hypothesis_rows,
    template_to_detail,
    template_to_summary,
    validate_template_meta,
)
from app.models import BusinessPlan
from app.plan_title import allocate_plan_title, company_name_from_inputs
from app.access_control import get_plan_for_user

router = APIRouter(tags=["templates"])
admin_router = APIRouter(prefix="/admin/templates", tags=["admin-templates"])


def _template_filters(
    q,
    *,
    secteur: str | None,
    sous_secteur: str | None,
    type_entreprise: str | None,
    type_financement: str | None,
    document_type: str | None,
    active_only: bool,
):
    if secteur:
        q = q.where(DocumentTemplate.secteur == secteur)
    if sous_secteur:
        q = q.where(DocumentTemplate.sous_secteur == sous_secteur)
    if type_entreprise:
        q = q.where(DocumentTemplate.type_entreprise == type_entreprise)
    if type_financement:
        q = q.where(DocumentTemplate.type_financement == type_financement)
    if document_type:
        q = q.where(
            (DocumentTemplate.document_type == document_type)
            | (DocumentTemplate.document_type == "ALL")
        )
    if active_only:
        q = q.where(DocumentTemplate.is_active.is_(True))
    return q


@router.get("/templates/taxonomy")
async def get_templates_taxonomy():
    return {"secteurs": list_taxonomy()}


@router.get("/templates", response_model=list[TemplateSummary])
async def list_templates(
    secteur: str | None = None,
    sous_secteur: str | None = None,
    type_entreprise: str | None = None,
    type_financement: str | None = None,
    document_type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(DocumentTemplate).where(
        (DocumentTemplate.is_public.is_(True)) | (DocumentTemplate.created_by_id == user.id)
    )
    q = _template_filters(
        q,
        secteur=secteur,
        sous_secteur=sous_secteur,
        type_entreprise=type_entreprise,
        type_financement=type_financement,
        document_type=document_type,
        active_only=True,
    )
    q = q.order_by(DocumentTemplate.usage_count.desc(), DocumentTemplate.name)
    result = await db.execute(q)
    return [TemplateSummary(**template_to_summary(t)) for t in result.scalars().all()]


@router.get("/templates/{template_id}", response_model=TemplateDetail)
async def get_template(
    template_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate)
        .where(DocumentTemplate.id == template_id)
        .options(selectinload(DocumentTemplate.hypothesis_rows))
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template introuvable")
    if not tpl.is_public and tpl.created_by_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    return TemplateDetail(**template_to_detail(tpl))


@router.post("/plans/from-template", response_model=PlanFromTemplateResponse, status_code=201)
async def create_plan_from_template(
    body: PlanFromTemplateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("client", "admin"):
        raise HTTPException(status_code=403, detail="Seuls les clients peuvent créer un plan")

    result = await db.execute(
        select(DocumentTemplate).where(
            DocumentTemplate.id == body.template_id,
            DocumentTemplate.is_active.is_(True),
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template introuvable ou inactif")
    if not tpl.is_public and tpl.created_by_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Template non accessible")

    inputs_dict = build_inputs_from_hypotheses(
        tpl.hypotheses or {},
        plan_name=body.plan_name,
        project_description=body.project_description,
        secteur=tpl.secteur,
        sous_secteur=tpl.sous_secteur,
        template_id=str(tpl.id),
        template_code=tpl.code,
    )
    plan = BusinessPlan(
        title=body.plan_name.strip(),
        owner_id=user.id,
        inputs=inputs_dict,
        status=BusinessPlanStatus.DRAFT.value,
    )
    db.add(plan)
    await db.flush()
    company = company_name_from_inputs(plan.inputs)
    if len(company.strip()) >= 2:
        plan.title = await allocate_plan_title(db, user.id, company, plan_id=plan.id)
    await ensure_default_scenarios(db, plan.id)
    tpl.usage_count = (tpl.usage_count or 0) + 1
    await db.commit()
    await db.refresh(plan)
    return PlanFromTemplateResponse(plan_id=plan.id, pre_filled_data=inputs_dict)


@router.post("/plans/{plan_id}/save-as-template", response_model=TemplateDetail, status_code=201)
async def save_plan_as_template(
    plan_id: UUID,
    body: SavePlanAsTemplateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    try:
        validate_template_meta(body.secteur, body.sous_secteur)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    hyp = extract_hypotheses_from_plan(plan)
    tpl = DocumentTemplate(
        name=body.name.strip(),
        version="v1.0",
        secteur=body.secteur,
        sous_secteur=body.sous_secteur,
        type_entreprise=body.type_entreprise,
        type_financement=body.type_financement,
        document_type=body.document_type,
        hypotheses=hyp,
        sections_incluses=[
            "resume_executif",
            "investissement",
            "financement",
            "exploitation",
            "rentabilite",
        ],
        description=f"Créé depuis le plan {plan.title}",
        created_by_id=user.id,
        is_active=True,
        is_public=body.is_public,
        usage_count=0,
    )
    db.add(tpl)
    await db.flush()
    for row in sync_hypothesis_rows(tpl):
        db.add(row)
    await db.commit()
    await db.refresh(tpl)
    result = await db.execute(
        select(DocumentTemplate)
        .where(DocumentTemplate.id == tpl.id)
        .options(selectinload(DocumentTemplate.hypothesis_rows))
    )
    saved = result.scalar_one()
    return TemplateDetail(**template_to_detail(saved))


# --- Admin ---


@admin_router.get("", response_model=list[TemplateDetail])
async def admin_list_templates(
    secteur: str | None = None,
    sous_secteur: str | None = None,
    type_entreprise: str | None = None,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(DocumentTemplate).options(selectinload(DocumentTemplate.hypothesis_rows))
    q = _template_filters(
        q,
        secteur=secteur,
        sous_secteur=sous_secteur,
        type_entreprise=type_entreprise,
        type_financement=None,
        document_type=None,
        active_only=False,
    )
    q = q.order_by(DocumentTemplate.secteur, DocumentTemplate.name)
    result = await db.execute(q)
    return [TemplateDetail(**template_to_detail(t)) for t in result.scalars().all()]


@admin_router.get("/stats")
async def admin_template_stats(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            DocumentTemplate.secteur,
            func.count(DocumentTemplate.id),
            func.coalesce(func.sum(DocumentTemplate.usage_count), 0),
        ).group_by(DocumentTemplate.secteur)
    )
    rows = [
        {"secteur": r[0], "count": r[1], "total_usage": int(r[2])}
        for r in result.all()
    ]
    top = await db.execute(
        select(DocumentTemplate)
        .order_by(DocumentTemplate.usage_count.desc())
        .limit(10)
    )
    return {
        "by_secteur": rows,
        "top_templates": [template_to_summary(t) for t in top.scalars().all()],
    }


@admin_router.get("/export.csv")
async def admin_export_templates_csv(
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DocumentTemplate).order_by(DocumentTemplate.secteur))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "code",
            "name",
            "secteur",
            "sous_secteur",
            "type_entreprise",
            "type_financement",
            "usage_count",
            "is_active",
            "hypotheses_json",
        ]
    )
    for t in result.scalars().all():
        w.writerow(
            [
                t.code or "",
                t.name,
                t.secteur,
                t.sous_secteur,
                t.type_entreprise,
                t.type_financement,
                t.usage_count,
                t.is_active,
                str(t.hypotheses or {}),
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=templates_export.csv"},
    )


@admin_router.post("", response_model=TemplateDetail, status_code=201)
async def admin_create_template(
    body: AdminTemplateCreate,
    admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        validate_template_meta(body.secteur, body.sous_secteur)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    tpl = DocumentTemplate(
        code=body.code,
        name=body.name,
        version=body.version,
        secteur=body.secteur,
        sous_secteur=body.sous_secteur,
        type_entreprise=body.type_entreprise,
        type_financement=body.type_financement,
        document_type=body.document_type,
        hypotheses=body.hypotheses,
        sections_incluses=body.sections_incluses,
        description=body.description,
        created_by_id=admin.id,
        is_active=body.is_active,
        is_public=body.is_public,
    )
    db.add(tpl)
    await db.flush()
    for row in sync_hypothesis_rows(tpl):
        db.add(row)
    await db.commit()
    result = await db.execute(
        select(DocumentTemplate)
        .where(DocumentTemplate.id == tpl.id)
        .options(selectinload(DocumentTemplate.hypothesis_rows))
    )
    return TemplateDetail(**template_to_detail(result.scalar_one()))


@admin_router.put("/{template_id}", response_model=TemplateDetail)
async def admin_update_template(
    template_id: UUID,
    body: AdminTemplateUpdate,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate)
        .where(DocumentTemplate.id == template_id)
        .options(selectinload(DocumentTemplate.hypothesis_rows))
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template introuvable")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(tpl, k, v)
    if body.hypotheses is not None:
        await db.execute(
            delete(TemplateHypothese).where(TemplateHypothese.template_id == tpl.id)
        )
        tpl.hypothesis_rows = []
        for row in sync_hypothesis_rows(tpl):
            db.add(row)
    await db.commit()
    result = await db.execute(
        select(DocumentTemplate)
        .where(DocumentTemplate.id == template_id)
        .options(selectinload(DocumentTemplate.hypothesis_rows))
    )
    return TemplateDetail(**template_to_detail(result.scalar_one()))


@admin_router.delete("/{template_id}", status_code=204)
async def admin_delete_template(
    template_id: UUID,
    _: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template introuvable")
    await db.delete(tpl)
    await db.commit()
