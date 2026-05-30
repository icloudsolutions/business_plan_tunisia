"""Timeline defaults, date helpers, Y1 revenue startup factor."""

from __future__ import annotations

import calendar
from datetime import date, timedelta

from bp_schema.timeline import (
    DEFAULT_HORIZON_MONTHS,
    DEFAULT_STARTUP_DELAY_DAYS,
    PHASE_TYPE_COLORS,
    TimelinePhase,
    TimelinePhaseType,
    TimelineSettings,
)

__all__ = [
    "DEFAULT_STARTUP_DELAY_DAYS",
    "DEFAULT_HORIZON_MONTHS",
    "PHASE_TYPE_COLORS",
    "y1_revenue_startup_factor",
    "apply_y1_startup_factor",
    "add_months",
    "month_index",
    "month_range_to_dates",
    "default_timeline_phases",
    "build_gantt_chart_data",
]


def y1_revenue_startup_factor(startup_delay_days: int, year_days: float = 365.0) -> float:
    """Y1 revenue share when sales start after startup delay (e.g. 90d → 275/365)."""
    if startup_delay_days <= 0:
        return 1.0
    return max(0.0, min(1.0, (year_days - startup_delay_days) / year_days))


def apply_y1_startup_factor(values: list[float], startup_delay_days: int) -> list[float]:
    if not values or startup_delay_days <= 0:
        return list(values)
    f = y1_revenue_startup_factor(startup_delay_days)
    out = list(values)
    out[0] = out[0] * f
    return out


def add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def month_range_to_dates(plan_start: date, start_month: int, end_month: int) -> tuple[date, date]:
    """Inclusive month indices 1..horizon (month 1 = plan_start month)."""
    start = plan_start if start_month <= 1 else add_months(plan_start, start_month - 1)
    end_anchor = add_months(plan_start, end_month)
    end = end_anchor - timedelta(days=1)
    if end < start:
        end = start
    return start, end


def month_index(plan_start: date, d: date) -> float:
    """1-based fractional month index for Gantt X-axis."""
    if d <= plan_start:
        return 1.0
    months = (d.year - plan_start.year) * 12 + (d.month - plan_start.month)
    day_frac = (d.day - 1) / max(1, calendar.monthrange(d.year, d.month)[1])
    return 1.0 + months + day_frac


def default_timeline_phases(settings: TimelineSettings) -> list[TimelinePhase]:
    """Six default phases aligned with VIPA Excel planning."""
    ps = settings.plan_start_date
    delay = settings.startup_delay_days
    horizon_end = settings.horizon_months
    specs: list[tuple[str, int, int, TimelinePhaseType]] = [
        ("Financement et constitution", 1, 2, "investment"),
        ("Acquisition équipements", 2, 4, "investment"),
        ("Installation et aménagement", 3, 5, "investment"),
        ("Formation du personnel", 4, 5, "startup"),
        ("Démarrage progressif", 5, 7, "startup"),
        ("Production normale", 7, horizon_end, "production"),
    ]
    phases: list[TimelinePhase] = []
    for i, (name, sm, em, ptype) in enumerate(specs):
        start, end = month_range_to_dates(ps, sm, em)
        phases.append(
            TimelinePhase(
                plan_id=settings.plan_id,
                name=name,
                start_date=start,
                end_date=end,
                phase_type=ptype,
                color=PHASE_TYPE_COLORS[ptype],
                sort_order=i,
            )
        )
    if delay != DEFAULT_STARTUP_DELAY_DAYS and len(phases) >= 5:
        phases[4].name = f"Démarrage progressif ({delay} j)"
    return phases


def build_gantt_chart_data(
    settings: TimelineSettings,
    phases: list[TimelinePhase],
    milestones: list | None = None,
) -> dict:
    """Serialize phases for frontend Gantt (month indices 1..horizon)."""
    ps = settings.plan_start_date
    rows = []
    for p in phases:
        rows.append(
            {
                "id": str(p.id) if p.id else None,
                "name": p.name,
                "phase_type": p.phase_type,
                "color": p.resolved_color(),
                "start_month": round(month_index(ps, p.start_date), 3),
                "end_month": round(month_index(ps, p.end_date), 3),
                "start_date": p.start_date.isoformat(),
                "end_date": p.end_date.isoformat(),
            }
        )
    ms = []
    for m in milestones or []:
        ms.append(
            {
                "key": m.key,
                "label": m.label,
                "date": m.date.isoformat(),
                "month_index": round(m.month_index, 3),
            }
        )
    return {
        "horizon_months": settings.horizon_months,
        "plan_start_date": ps.isoformat(),
        "startup_delay_days": settings.startup_delay_days,
        "y1_revenue_factor": y1_revenue_startup_factor(settings.startup_delay_days),
        "phases": rows,
        "milestones": ms,
    }
