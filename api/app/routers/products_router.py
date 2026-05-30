"""Multi-product revenue CRUD and projection."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_schema.revenue import RevenueProjection

from app.access_control import get_plan_for_user
from app.auth import get_current_user
from app.celery_client import celery_app
from app.database import get_db
from app.models import BusinessPlan, CalcJob, PlanProduct, PlanRevenueAssumptions, User
from app.revenue_service import compute_projection, get_or_create_assumptions, load_products
from app.schemas import (
    JobResponse,
    PlanProductCreate,
    PlanProductResponse,
    PlanProductUpdate,
    RevenueAssumptionsResponse,
    RevenueAssumptionsUpdate,
    RevenueProjectionResponse,
)
from app.workflow_policy import PlanAction, assert_plan_action

router = APIRouter(prefix="/plans", tags=["products"])


def _product_response(row: PlanProduct) -> PlanProductResponse:
    return PlanProductResponse.model_validate(row)


@router.get("/{plan_id}/products", response_model=list[PlanProductResponse])
async def list_products(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_plan_for_user(plan_id, user, db)
    result = await db.execute(
        select(PlanProduct)
        .where(PlanProduct.plan_id == plan_id)
        .order_by(PlanProduct.sort_order, PlanProduct.created_at)
    )
    return [_product_response(r) for r in result.scalars().all()]


@router.post("/{plan_id}/products", response_model=PlanProductResponse, status_code=201)
async def create_product(
    plan_id: UUID,
    body: PlanProductCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    await get_or_create_assumptions(db, plan_id, plan.inputs)

    count = await db.scalar(
        select(func.count()).select_from(PlanProduct).where(PlanProduct.plan_id == plan_id)
    )
    row = PlanProduct(
        plan_id=plan_id,
        name=body.name.strip(),
        unit=body.unit,
        unit_price_sell=body.unit_price_sell,
        ristourne_pct=body.ristourne_pct,
        monthly_qty_y1=body.monthly_qty_y1,
        sort_order=body.sort_order if body.sort_order is not None else int(count or 0),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _product_response(row)


@router.patch("/{plan_id}/products/{product_id}", response_model=PlanProductResponse)
async def update_product(
    plan_id: UUID,
    product_id: UUID,
    body: PlanProductUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanProduct, product_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for field in ("name", "unit", "unit_price_sell", "ristourne_pct", "monthly_qty_y1", "sort_order"):
        val = getattr(body, field, None)
        if val is not None:
            if field == "name":
                setattr(row, field, str(val).strip())
            else:
                setattr(row, field, val)
    await db.commit()
    await db.refresh(row)
    return _product_response(row)


@router.delete("/{plan_id}/products/{product_id}", status_code=204)
async def delete_product(
    plan_id: UUID,
    product_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await db.get(PlanProduct, product_id)
    if not row or row.plan_id != plan_id:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    await db.delete(row)
    await db.commit()


@router.get("/{plan_id}/revenue-assumptions", response_model=RevenueAssumptionsResponse)
async def get_revenue_assumptions(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    row = await get_or_create_assumptions(db, plan_id, plan.inputs)
    await db.commit()
    return RevenueAssumptionsResponse.model_validate(row)


@router.put("/{plan_id}/revenue-assumptions", response_model=RevenueAssumptionsResponse)
async def upsert_revenue_assumptions(
    plan_id: UUID,
    body: RevenueAssumptionsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assert_plan_action(plan, user, PlanAction.PATCH_INPUTS)
    row = await get_or_create_assumptions(db, plan_id, plan.inputs)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    row.projection_cache = None
    await db.commit()
    await db.refresh(row)
    return RevenueAssumptionsResponse.model_validate(row)


@router.get("/{plan_id}/revenue-projection", response_model=RevenueProjectionResponse)
async def get_revenue_projection(
    plan_id: UUID,
    sync: bool = Query(
        True,
        description="true = aperçu live synchrone ; false = lance Celery et renvoie la projection en cache si disponible",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    assump = await get_or_create_assumptions(db, plan_id, plan.inputs)

    if not sync:
        job = CalcJob(
            plan_id=plan.id,
            task_type="revenue_projection",
            status="PENDING",
            payload={},
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        task = celery_app.send_task(
            "worker.tasks.calculate_revenue_projection",
            args=[str(plan.id), str(job.id)],
            queue="calc",
        )
        job.celery_task_id = task.id
        await db.commit()
        if assump.projection_cache:
            return RevenueProjectionResponse.model_validate(assump.projection_cache)
        projection = await compute_projection(db, plan_id, plan.inputs)
        return RevenueProjectionResponse.from_projection(projection)

    projection = await compute_projection(db, plan_id, plan.inputs)
    return RevenueProjectionResponse.from_projection(projection)


@router.post("/{plan_id}/revenue-projection", response_model=JobResponse, status_code=202)
async def queue_revenue_projection(
    plan_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await get_plan_for_user(plan_id, user, db)
    job = CalcJob(
        plan_id=plan.id,
        task_type="revenue_projection",
        status="PENDING",
        payload={},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    task = celery_app.send_task(
        "worker.tasks.calculate_revenue_projection",
        args=[str(plan.id), str(job.id)],
        queue="calc",
    )
    job.celery_task_id = task.id
    await db.commit()
    return JobResponse(id=job.id, status=job.status, task_type=job.task_type)
