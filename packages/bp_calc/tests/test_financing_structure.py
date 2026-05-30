from bp_calc.financing_structure import build_financing_structure
from bp_schema.financing_plan import FinancingSource
from bp_schema.liasse import PlanInputs


def test_financing_gap_and_equity_ratio():
    inputs = PlanInputs.model_validate(
        {
            "investments": {
                "equipment": [{"name": "Ligne", "cost": 1_000_000, "usefulLifeYears": 10}]
            },
            "operations": {
                "capacityPerMinute": 100,
                "salePrice": 2,
                "rawMaterialCost": 0.5,
                "packagingCost": 0.1,
                "workingDaysPerYear": 250,
                "hoursPerDay": 8,
            },
            "workingCapital": {
                "clientPaymentDays": 33,
                "supplierPaymentDays": 30,
            },
        }
    )
    sources = [
        FinancingSource(source_type="fonds_propres", label="Fonds propres", amount=400_000),
        FinancingSource(source_type="cmt", label="CMT BIAT", amount=700_000, rate=0.083),
    ]
    proj = build_financing_structure(inputs, sources)
    assert proj.investment.fixed_assets_total == 1_000_000
    assert proj.investment.initial_bfr > 0
    assert proj.summary.total_financing_need == proj.investment.fixed_assets_total + proj.investment.initial_bfr
    assert abs(proj.summary.gap) < 1 or proj.summary.gap > 0
