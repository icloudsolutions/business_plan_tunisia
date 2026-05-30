"""Timeline (Gantt) CRUD and projection with milestones."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from bp_calc.kpi_dashboard import build_kpi_dashboard
from bp_calc.projections import apply_scenario_to_inputs
from bp_calc.timeline import (
    add_months,
    build_gantt_chart_data,
    default_timeline_phases,
    month_index,
    month_range_to_dates,
    y1_revenue_startup_factor,
)
from bp_schema.liasse import PlanInputs
from bp_schema.timeline import (
    TimelineMilestone,
    TimelinePhase,
    TimelineProjection,
    TimelineSettings,
)
from app.config import settings as app_settings
from app.loan_service import load_plan_loans
from app.models import PlanTimelinePhase as PlanTimelinePhaseORM
from app.models import PlanTimelineSettings as PlanTimelineSettingsORM


async def load_startup_delay_days(db: AsyncSession, plan_id: UUID) -> int:
    row = await db.get(PlanTimelineSettingsORM, plan_id)
    return row.startup_delay_days if row else 90


async def get_or_create_timeline_settings(
    db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None
) -> PlanTimelineSettingsORM:
    row = await db.get(PlanTimelineSettingsORM, plan_id)
    if row:
        return row
    start = date.today().replace(day=1)
    delay = 90
    if plan_inputs:
        try:
            ops = PlanInputs.model_validate(plan_inputs).operations
            if getattr(ops, "startupDelayDays", None):
                delay = int(ops.startupDelayDays)
        except Exception:
            pass
    row = PlanTimelineSettingsORM(
        plan_id=plan_id,
        plan_start_date=start,
        startup_delay_days=delay,
        horizon_months=18,
    )
    db.add(row)
    await db.flush()
    return row


def _phase_from_orm(row: PlanTimelinePhaseORM) -> TimelinePhase:
    return TimelinePhase(
        id=row.id,
        plan_id=row.plan_id,
        name=row.name,
        start_date=row.start_date,
        end_date=row.end_date,
        phase_type=row.phase_type,  # type: ignore[arg-type]
        color=row.color or "",
        sort_order=row.sort_order,
    )


async def load_phases(db: AsyncSession, plan_id: UUID) -> list[TimelinePhase]:
    result = await db.execute(
        select(PlanTimelinePhaseORM)
        .where(PlanTimelinePhaseORM.plan_id == plan_id)
        .order_by(PlanTimelinePhaseORM.sort_order, PlanTimelinePhaseORM.created_at)
    )
    return [_phase_from_orm(r) for r in result.scalars().all()]


async def ensure_default_phases(db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None) -> list[TimelinePhase]:
    existing = await load_phases(db, plan_id)
    if existing:
        return existing
    settings_row = await get_or_create_timeline_settings(db, plan_id, plan_inputs)
    settings = TimelineSettings(
        plan_id=plan_id,
        plan_start_date=settings_row.plan_start_date,
        startup_delay_days=settings_row.startup_delay_days,
        horizon_months=settings_row.horizon_months,
    )
    for p in default_timeline_phases(settings):
        row = PlanTimelinePhaseORM(
            plan_id=plan_id,
            name=p.name,
            start_date=p.start_date,
            end_date=p.end_date,
            phase_type=p.phase_type,
            color=p.color,
            sort_order=p.sort_order,
        )
        db.add(row)
    await db.flush()
    return await load_phases(db, plan_id)


async def _build_milestones(
    db: AsyncSession,
    plan_id: UUID,
    settings: TimelineSettings,
    phases: list[TimelinePhase],
    plan_inputs: dict,
) -> list[TimelineMilestone]:
    milestones: list[TimelineMilestone] = []
    ps = settings.plan_start_date

    prod_phases = [p for p in phases if p.phase_type == "production"]
    if prod_phases:
        d = prod_phases[0].start_date
        milestones.append(
            TimelineMilestone(
                key="first_production",
                label="Première production",
                date=d,
                month_index=month_index(ps, d),
            )
        )
    elif phases:
        d = phases[-1].start_date
        milestones.append(
            TimelineMilestone(
                key="first_production",
                label="Démarrage production",
                date=d,
                month_index=month_index(ps, d),
            )
        )

    try:
        inputs = PlanInputs.model_validate(plan_inputs or {})
        scenario_inputs = apply_scenario_to_inputs(inputs)
        kpi = build_kpi_dashboard(scenario_inputs, discount_rate=app_settings.discount_rate)
        be_rev = kpi.capacity.break_even_revenue
        if be_rev > 0:
            y1 = date(ps.year + (ps.month // 12), ((ps.month - 1 + 6) % 12) + 1, 1)
            milestones.append(
                TimelineMilestone(
                    key="break_even_revenue",
                    label="Seuil de rentabilité (CA)",
                    date=y1,
                    month_index=month_index(ps, y1),
                )
            )
    except Exception:
        pass

    loans = await load_plan_loans(db, plan_id)
    grace_m = 12
    if loans:
        grace_m = max(loans[0].grace_months, 0)
        combined = aggregate_loan_projections(loans, plan_id=plan_id)
        if any(p > 0 for p in combined.annual_principal):
            pass
    else:
        try:
            inputs = PlanInputs.model_validate(plan_inputs or {})
            grace_m = inputs.financing.loan.graceMonthsPrincipal or 12
        except Exception:
            grace_m = 12
    d = add_months(ps, grace_m)
    milestones.append(
        TimelineMilestone(
            key="first_loan_repayment",
            label="1er remboursement dette",
            date=d,
            month_index=month_index(ps, d),
        )
    )

    return milestones


async def compute_timeline_projection(
    db: AsyncSession,
    plan_id: UUID,
    plan_inputs: dict | None = None,
) -> dict:
    settings_row = await get_or_create_timeline_settings(db, plan_id, plan_inputs)
    phases = await ensure_default_phases(db, plan_id, plan_inputs)
    settings = TimelineSettings(
        plan_id=plan_id,
        plan_start_date=settings_row.plan_start_date,
        startup_delay_days=settings_row.startup_delay_days,
        horizon_months=settings_row.horizon_months,
    )
    milestones = await _build_milestones(db, plan_id, settings, phases, plan_inputs or {})
    chart = build_gantt_chart_data(settings, phases, milestones)
    proj = TimelineProjection(
        plan_id=plan_id,
        settings=settings,
        phases=phases,
        milestones=milestones,
        y1_revenue_factor=y1_revenue_startup_factor(settings.startup_delay_days),
        chart=chart,
    )
    return proj.model_dump()


async def reset_default_phases(db: AsyncSession, plan_id: UUID, plan_inputs: dict | None = None) -> list[TimelinePhase]:
    await db.execute(delete(PlanTimelinePhaseORM).where(PlanTimelinePhaseORM.plan_id == plan_id))
    settings_row = await get_or_create_timeline_settings(db, plan_id, plan_inputs)
    settings = TimelineSettings(
        plan_id=plan_id,
        plan_start_date=settings_row.plan_start_date,
        startup_delay_days=settings_row.startup_delay_days,
        horizon_months=settings_row.horizon_months,
    )
    for p in default_timeline_phases(settings):
        db.add(
            PlanTimelinePhaseORM(
                plan_id=plan_id,
                name=p.name,
                start_date=p.start_date,
                end_date=p.end_date,
                phase_type=p.phase_type,
                color=p.color,
                sort_order=p.sort_order,
            )
        )
    await db.flush()
    return await load_phases(db, plan_id)


def render_gantt_svg(chart: dict, width: int = 900, height: int = 420) -> str:
    """PDF-ready SVG Gantt for Liasse export."""
    horizon = chart.get("horizon_months", 18)
    phases = chart.get("phases", [])
    milestones = chart.get("milestones", [])
    margin_l, margin_t, margin_r, margin_b = 200, 40, 40, 50
    plot_w = width - margin_l - margin_r
    plot_h = height - margin_t - margin_b
    row_h = plot_h / max(len(phases), 1)

    def x_pos(month: float) -> float:
        return margin_l + (month - 1) / horizon * plot_w

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{margin_l}" y="24" font-family="Arial,sans-serif" font-size="14" font-weight="bold">Planning de réalisation</text>',
    ]
    for m in range(1, horizon + 1):
        x = x_pos(m)
        lines.append(f'<line x1="{x:.1f}" y1="{margin_t}" x2="{x:.1f}" y2="{height - margin_b}" stroke="#e2e8f0"/>')
        lines.append(
            f'<text x="{x:.1f}" y="{height - 12}" text-anchor="middle" font-size="9" fill="#64748b">M{m}</text>'
        )
    for i, p in enumerate(phases):
        y = margin_t + i * row_h + 8
        x1 = x_pos(p["start_month"])
        x2 = x_pos(p["end_month"])
        w = max(4, x2 - x1)
        color = p.get("color", "#64748b")
        lines.append(f'<text x="8" y="{y + 14}" font-size="10" fill="#334155">{_esc(p["name"][:28])}</text>')
        lines.append(
            f'<rect x="{x1:.1f}" y="{y:.1f}" width="{w:.1f}" height="{row_h - 16:.1f}" rx="4" fill="{color}" opacity="0.85"/>'
        )
    for ms in milestones:
        x = x_pos(ms["month_index"])
        lines.append(f'<line x1="{x:.1f}" y1="{margin_t}" x2="{x:.1f}" y2="{height - margin_b}" stroke="#dc2626" stroke-dasharray="4,3"/>')
        lines.append(
            f'<text x="{x:.1f}" y="{margin_t - 6}" text-anchor="middle" font-size="8" fill="#dc2626">{_esc(ms["label"][:20])}</text>'
        )
    delay = chart.get("startup_delay_days", 90)
    factor = chart.get("y1_revenue_factor", 1)
    lines.append(
        f'<text x="{margin_l}" y="{height - 28}" font-size="9" fill="#475569">Délai démarrage: {delay} j · Facteur CA Y1: {factor:.0%}</text>'
    )
    lines.append("</svg>")
    return "\n".join(lines)


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
