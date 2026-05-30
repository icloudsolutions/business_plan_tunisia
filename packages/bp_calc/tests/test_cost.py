from uuid import uuid4

from bp_calc.cost import compute_unit_cost, total_annual_payroll, weight_kg_per_unit
from bp_schema.cost import CostAllocationContext, ProductCostComponents
from bp_schema.liasse import PlanInputs, PlAssumptions, PersonnelLine
from bp_schema.revenue import PlanProduct


def test_unit_cost_formula():
    comp = ProductCostComponents(
        mp_price_per_kg=2.0,
        arome_rate_pct=0.05,
        packaging_g_per_unit=500,
        packaging_price_per_kg=4.0,
        gas_monthly=1000,
        electricity_monthly=2000,
        water_monthly=500,
        waste_pct=0.01,
    )
    alloc = CostAllocationContext(
        annual_payroll=120000,
        annual_depreciation=50000,
        total_production_kg=100000,
    )
    kg = 0.5
    r = compute_unit_cost(
        comp,
        sell_price=5.0,
        kg_per_unit=kg,
        allocation=alloc,
        product_id="p1",
        name="Test",
    )
    assert r.breakdown.mp == 2.0 * kg
    assert r.breakdown.arome == r.breakdown.mp * 0.05
    assert r.breakdown.packaging == 4.0 * 0.5
    assert r.unit_cost > 0
    assert r.gross_margin_rate is not None


def test_payroll_from_inputs():
    inputs = PlanInputs(
        plAssumptions=PlAssumptions(
            personnel=[PersonnelLine(role="Op", headcount=2, annualSalary=30000)]
        )
    )
    assert total_annual_payroll(inputs) == 60000


def test_weight_kg_sachet():
    p = PlanProduct(unit="sachet")
    assert weight_kg_per_unit(p, 250) == 0.25
