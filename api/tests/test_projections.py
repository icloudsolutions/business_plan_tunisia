"""Projections payload for finance cockpit."""

from bp_calc.projections import build_projection_payload, build_all_scenarios
from bp_schema.liasse import PlanInputs


def test_build_projection_payload_has_pl_and_kpis():
    inputs = PlanInputs()
    payload = build_projection_payload(inputs, scenario="base")
    assert len(payload["pl"]) == 7
    assert "van" in payload["kpis"]
    assert isinstance(payload["investments"], list)


def test_all_scenarios():
    inputs = PlanInputs()
    all_s = build_all_scenarios(inputs)
    assert "base" in all_s and "pessimistic" in all_s and "optimistic" in all_s
    assert all_s["pessimistic"]["pl"][0]["revenue"] <= all_s["optimistic"]["pl"][0]["revenue"]
