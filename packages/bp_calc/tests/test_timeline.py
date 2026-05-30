from datetime import date

from bp_calc.timeline import (
    apply_y1_startup_factor,
    default_timeline_phases,
    month_range_to_dates,
    y1_revenue_startup_factor,
)
from bp_schema.timeline import TimelineSettings


def test_startup_factor_90_days():
    f = y1_revenue_startup_factor(90)
    assert abs(f - (365 - 90) / 365) < 0.01


def test_apply_y1_factor():
    assert apply_y1_startup_factor([100.0, 200.0], 90)[0] < 100.0
    assert apply_y1_startup_factor([100.0, 200.0], 90)[1] == 200.0


def test_default_six_phases():
    settings = TimelineSettings(plan_start_date=date(2026, 1, 1))
    phases = default_timeline_phases(settings)
    assert len(phases) == 6
    assert phases[0].name.startswith("Financement")


def test_month_range():
    start, end = month_range_to_dates(date(2026, 1, 1), 1, 2)
    assert start == date(2026, 1, 1)
    assert end.month == 2
