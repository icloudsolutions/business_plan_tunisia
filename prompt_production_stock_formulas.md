# ❌ NOT IMPLEMENTED — Production & Stock Chain Formulas
**Repo:** icloudsolutions/business_plan_tunisia  
**Audit date:** 2026-05-30  
**Files checked:** `engine.py`, `bfr.py`, `capex.py`, `loan.py`, `tva.py`, `patch.py`, `indicators.py`, `balance.py`, `liasse.py`

---

## 🔍 Audit Result: 0 / 5 Formulas Implemented

| Formula | Expected | Found in code | Status |
|---|---|---|---|
| `qty_produced = qty_sold + closing_stock_PF` | Stock-based production derivation | ❌ Not found | **MISSING** |
| `qty_consumed = qty_produced × 1.01` (101% = waste) | 1% waste on consumption | `waste = ops.waste_for_year()` applied to **capacity**, not consumption | **WRONG LOCATION** |
| `qty_purchased = qty_consumed / 12 × stock_months_MP` | Purchase from consumption + stock months | ❌ Not found — engine uses `raw_c = units × material_unit_cost` directly | **MISSING** |
| `closing_stock_MP = qty_purchased − qty_consumed` | Explicit stock balance | ❌ Not found — BFR uses `raw_stock = purchases × days / 365` (value-based, not qty-based) | **MISSING** |
| `production_days = 320 / 310 × selling_days` | Production/selling day ratio | ❌ `workingDaysPerYear` is a flat input, ratio never applied | **MISSING** |
| `purchases = (consumption − opening_stock) × 13/12` | Liasse Unique purchase formula | ❌ Not found — no opening stock, no 13/12 multiplier | **MISSING** |

**What the engine currently does instead:**  
`raw_consumption[y] = units_by_year[y] × rawMaterialCost × 1.03^y`  
→ This computes a **cost value** directly from capacity units, bypassing the entire physical quantity chain. There is no quantity-level modelling, no stock balance, no Liasse-compliant purchase formula.

---

## 📐 The Complete Formula Chain to Implement

```
INPUTS:
  qty_sold_y1          ← from revenue module (qty sold per product per year)
  stock_days_PF        ← WorkingCapital.finishedGoodsStockDays (default: 10j)
  waste_rate           ← Operations.wasteRate.value (default: 1% = 0.01)
  stock_months_MP      ← WorkingCapital.rawMaterialStockMonths (default: 1 month)
  selling_days         ← Operations.workingDaysPerYear (default: 310j/year)
  production_ratio     ← 320 / 310  (fixed constant from Liasse Unique)
  opening_stock_MP_y1  ← 0 (no prior stock at plan start)

STEP 1 — Production quantity (Liasse: "Production = 320/310 × jours vente")
  production_days = selling_days × (320 / 310)
  # = 310 × 1.0322... = ~320 production days
  
  qty_produced[y] = qty_sold[y] + closing_stock_PF[y]
  
  where:
    closing_stock_PF[y] = qty_sold[y] × stock_days_PF / selling_days
    # e.g. 10j / 310j = 3.226% of annual sales

STEP 2 — Consumption with waste (Liasse: "consommation = 101% × production")
  qty_consumed[y] = qty_produced[y] × (1 + waste_rate)
  # waste_rate = 0.01 → multiply by 1.01

STEP 3 — Purchases (Liasse: "Achat = (consommation − SI) × 13/12")
  opening_stock_MP[0] = 0
  opening_stock_MP[y] = closing_stock_MP[y-1]   # for y > 0

  qty_purchased[y] = (qty_consumed[y] − opening_stock_MP[y]) × (13 / 12)
  # The ×13/12 factor ensures 1 month of MP stock is maintained

STEP 4 — Closing raw material stock
  closing_stock_MP[y] = qty_purchased[y] − qty_consumed[y]
  # Should equal ~1 month of consumption
  # = qty_consumed[y] / 12   (verification check)

STEP 5 — Purchase value (feeds P&L and BFR)
  purchase_value_MP[y] = qty_purchased[y] × price_per_unit_MP[y]
  # price can inflate year-over-year if mp_price_inflation_rate > 0

STEP 6 — Stock values (feeds balance sheet)
  stock_value_MP[y]  = closing_stock_MP[y]  × price_per_unit_MP[y]
  stock_value_PF[y]  = closing_stock_PF[y]  × unit_cost_PF[y]
  # unit_cost_PF comes from cost build-up module (Prompt B)
```

---

## 🛠️ Implementation Prompt

```
Implement the Liasse Unique-compliant production and inventory calculation 
chain in the business_plan_tunisia platform.

This is a backend-only change to packages/bp_calc and packages/bp_schema.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — Schema changes (packages/bp_schema/bp_schema/liasse.py)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1a. Extend WorkingCapital:
    class WorkingCapital(BaseModel):
        clientPaymentDays: int = 30
        supplierPaymentDays: int = 30
        finishedGoodsStockDays: int = 10      # existing — keep
        rawMaterialStockMonths: float = 1.0   # ADD (replaces rawMaterialStockDays)
        packagingStockMonths: float = 1.0     # ADD
        # Keep rawMaterialStockDays for backward compat, but compute from months:
        @property
        def rawMaterialStockDays(self) -> float:
            return self.rawMaterialStockMonths * 30.42

1b. Extend Operations:
    class Operations(BaseModel):
        ...existing fields...
        workingDaysPerYear: float = 310.0     # CHANGE default from 250 to 310
        productionDaysPerYear: float | None = None
        # If None, auto-compute as workingDaysPerYear × (320/310)
        
        @property
        def effective_production_days(self) -> float:
            if self.productionDaysPerYear is not None:
                return self.productionDaysPerYear
            return self.workingDaysPerYear * (320.0 / 310.0)

        qtySoldY1: float | None = None
        # If provided, use quantity-based chain; 
        # if None, fall back to capacity-based (current behavior)
        mpPricePerUnit: float = 0.0           # ADD: price per kg of raw material
        mpPriceInflationRate: float = 0.0     # ADD: annual MP price increase

1c. Add new result series to PlanResults:
    class PlanResults(BaseModel):
        ...existing...
        qtyProduced: YearlySeries = Field(default_factory=YearlySeries)
        qtyConsumed: YearlySeries = Field(default_factory=YearlySeries)
        qtyPurchased: YearlySeries = Field(default_factory=YearlySeries)
        closingStockPF: YearlySeries = Field(default_factory=YearlySeries)
        closingStockMP: YearlySeries = Field(default_factory=YearlySeries)
        openingStockMP: YearlySeries = Field(default_factory=YearlySeries)
        purchaseValueMP: YearlySeries = Field(default_factory=YearlySeries)
        stockValueMP: YearlySeries = Field(default_factory=YearlySeries)
        stockValuePF: YearlySeries = Field(default_factory=YearlySeries)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — New module (packages/bp_calc/bp_calc/inventory.py)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create packages/bp_calc/bp_calc/inventory.py with the following:

"""
Liasse Unique-compliant production and inventory quantity chain.

Formulas (from Hypothèse sheet — Tunisian standard):
  Production = 320/310 × jours vente
  consommation = 101% × production  (waste = 1%)
  Achat = (consommation − SI) × 13/12
  Stock final MP = Achat − consommation
  Stock final PF = estimation en jours de CA
"""

PRODUCTION_SELLING_RATIO = 320.0 / 310.0   # ≈ 1.03226
PURCHASE_MULTIPLIER = 13.0 / 12.0          # = 1.08333...
HORIZON = 7


def compute_qty_produced(
    qty_sold: list[float],
    stock_days_pf: float,
    selling_days: float,
) -> tuple[list[float], list[float]]:
    """
    Returns (qty_produced, closing_stock_PF) for each year.
    
    Formula:
      closing_stock_PF[y] = qty_sold[y] × stock_days_PF / selling_days
      qty_produced[y]     = qty_sold[y] + closing_stock_PF[y]
    """
    closing_pf = []
    qty_produced = []
    for y in range(len(qty_sold)):
        c_pf = qty_sold[y] * stock_days_pf / selling_days
        closing_pf.append(c_pf)
        qty_produced.append(qty_sold[y] + c_pf)
    return qty_produced, closing_pf


def compute_qty_consumed(
    qty_produced: list[float],
    waste_rate: float = 0.01,
) -> list[float]:
    """
    Formula: consommation = qty_produced × (1 + waste_rate)
    Liasse: consommation = 101% de la production (taux de déchet = 1%)
    """
    return [qp * (1.0 + waste_rate) for qp in qty_produced]


def compute_purchases_and_stock_mp(
    qty_consumed: list[float],
    opening_stock_mp_y0: float = 0.0,
) -> tuple[list[float], list[float], list[float]]:
    """
    Returns (qty_purchased, closing_stock_MP, opening_stock_MP) per year.
    
    Formula (Liasse Unique):
      opening_stock_MP[0] = opening_stock_mp_y0  (= 0 for new projects)
      opening_stock_MP[y] = closing_stock_MP[y-1]  for y > 0
      
      qty_purchased[y] = (qty_consumed[y] − opening_stock_MP[y]) × 13/12
      closing_stock_MP[y] = qty_purchased[y] − qty_consumed[y]
      
    The ×13/12 factor ensures closing_stock_MP ≈ 1 month of consumption.
    Verification: closing_stock_MP[y] should ≈ qty_consumed[y] / 12
    """
    opening = [opening_stock_mp_y0]
    purchased = []
    closing = []

    for y in range(len(qty_consumed)):
        si = opening[y]
        qp = (qty_consumed[y] - si) * PURCHASE_MULTIPLIER
        qp = max(0.0, qp)   # purchases cannot be negative
        cf = qp - qty_consumed[y]
        purchased.append(qp)
        closing.append(cf)
        if y + 1 < len(qty_consumed):
            opening.append(cf)

    return purchased, closing, opening


def compute_purchase_values(
    qty_purchased: list[float],
    mp_price_y1: float,
    inflation_rate: float = 0.0,
) -> list[float]:
    """
    purchase_value[y] = qty_purchased[y] × mp_price[y]
    mp_price[y] = mp_price_y1 × (1 + inflation_rate)^y
    """
    values = []
    for y, qty in enumerate(qty_purchased):
        price = mp_price_y1 * ((1.0 + inflation_rate) ** y)
        values.append(qty * price)
    return values


def inventory_chain(
    qty_sold: list[float],
    stock_days_pf: float,
    selling_days: float,
    waste_rate: float,
    mp_price_y1: float,
    mp_price_inflation: float = 0.0,
    opening_stock_mp_y0: float = 0.0,
) -> dict:
    """
    Full production-to-purchase chain. Returns all intermediate series.
    
    Args:
        qty_sold:              Annual sold quantity (kg or units) for Y1-Y7
        stock_days_pf:         Finished goods stock in selling days (e.g. 10)
        selling_days:          Working/selling days per year (e.g. 310)
        waste_rate:            Decimal waste rate (e.g. 0.01 = 1%)
        mp_price_y1:           Raw material price per unit in Year 1 (DT/kg)
        mp_price_inflation:    Annual MP price increase rate (e.g. 0.03)
        opening_stock_mp_y0:   Initial MP stock (0 for new projects)
    
    Returns dict with keys:
        qty_produced, closing_stock_pf, qty_consumed,
        qty_purchased, closing_stock_mp, opening_stock_mp,
        purchase_value_mp
    """
    qty_produced, closing_stock_pf = compute_qty_produced(
        qty_sold, stock_days_pf, selling_days
    )
    qty_consumed = compute_qty_consumed(qty_produced, waste_rate)
    qty_purchased, closing_stock_mp, opening_stock_mp = (
        compute_purchases_and_stock_mp(qty_consumed, opening_stock_mp_y0)
    )
    purchase_value = compute_purchase_values(
        qty_purchased, mp_price_y1, mp_price_inflation
    )

    return {
        "qty_produced": qty_produced,
        "closing_stock_pf": closing_stock_pf,
        "qty_consumed": qty_consumed,
        "qty_purchased": qty_purchased,
        "closing_stock_mp": closing_stock_mp,
        "opening_stock_mp": opening_stock_mp,
        "purchase_value_mp": purchase_value,
    }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — engine.py integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In calculate_plan(), after computing revenue_ht, add:

  from bp_calc.inventory import inventory_chain

  ops = inputs.operations
  wc  = inputs.workingCapital

  # Use quantity-based chain if qtySoldY1 is provided
  if ops.qtySoldY1 is not None:
      # Build qty_sold series applying same growth as revenue
      qty_sold_series = [ops.qtySoldY1]
      for y in range(1, HORIZON):
          qty_sold_series.append(qty_sold_series[y-1] * 1.03)  # or per-year rate

      inv = inventory_chain(
          qty_sold=qty_sold_series,
          stock_days_pf=wc.finishedGoodsStockDays,
          selling_days=ops.workingDaysPerYear,
          waste_rate=ops.wasteRate.value,
          mp_price_y1=ops.mpPricePerUnit,
          mp_price_inflation=ops.mpPriceInflationRate,
          opening_stock_mp_y0=0.0,
      )
      # Override consumption from quantity chain
      consumption = inv["purchase_value_mp"]   # value-based for P&L
      raw_consumption = inv["purchase_value_mp"]
  else:
      # Fallback: existing capacity-based logic (backward compatible)
      inv = None

  # Add to PlanResults:
  if inv:
      results.qtyProduced    = YearlySeries(years=inv["qty_produced"])
      results.qtyConsumed    = YearlySeries(years=inv["qty_consumed"])
      results.qtyPurchased   = YearlySeries(years=inv["qty_purchased"])
      results.closingStockPF = YearlySeries(years=inv["closing_stock_pf"])
      results.closingStockMP = YearlySeries(years=inv["closing_stock_mp"])
      results.openingStockMP = YearlySeries(years=inv["opening_stock_mp"])
      results.purchaseValueMP= YearlySeries(years=inv["purchase_value_mp"])

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — Tests (packages/bp_calc/tests/test_inventory.py)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create packages/bp_calc/tests/test_inventory.py:

"""Tests for Liasse Unique inventory chain formulas."""

import pytest
from bp_calc.inventory import (
    compute_qty_produced,
    compute_qty_consumed,
    compute_purchases_and_stock_mp,
    inventory_chain,
    PURCHASE_MULTIPLIER,
    PRODUCTION_SELLING_RATIO,
)


# ── VIPA reference data from Excel (Year 1, PF Maïs) ───────────────────────
VIPA_QTY_SOLD_Y1     = 374_400    # sachets/year  (37440 kg / month × 10 months)
VIPA_STOCK_DAYS_PF   = 10         # days
VIPA_SELLING_DAYS    = 310        # days/year
VIPA_WASTE_RATE      = 0.01       # 1%
VIPA_MP_PRICE_Y1     = 2.80       # DT/kg (Maïs)


class TestProductionSellRatio:
    def test_ratio_constant(self):
        assert abs(PRODUCTION_SELLING_RATIO - 320 / 310) < 1e-9

    def test_effective_production_days(self):
        """310 selling days → ~320 production days"""
        from bp_schema.liasse import Operations
        ops = Operations(workingDaysPerYear=310)
        assert abs(ops.effective_production_days - 320.0) < 0.5


class TestQtyProduced:
    def test_single_year_vipa(self):
        produced, closing_pf = compute_qty_produced(
            [VIPA_QTY_SOLD_Y1], VIPA_STOCK_DAYS_PF, VIPA_SELLING_DAYS
        )
        # closing_PF = 374400 × 10/310 ≈ 12077 sachets
        assert abs(closing_pf[0] - 374_400 * 10 / 310) < 1.0
        # produced = sold + closing_PF
        assert abs(produced[0] - (VIPA_QTY_SOLD_Y1 + closing_pf[0])) < 0.01

    def test_produced_always_gte_sold(self):
        sold = [100_000, 115_000, 132_000]
        produced, _ = compute_qty_produced(sold, 10, 310)
        for s, p in zip(sold, produced):
            assert p >= s


class TestQtyConsumed:
    def test_waste_adds_1_percent(self):
        produced = [100_000.0]
        consumed = compute_qty_consumed(produced, waste_rate=0.01)
        assert abs(consumed[0] - 101_000.0) < 0.01

    def test_zero_waste(self):
        produced = [50_000.0]
        consumed = compute_qty_consumed(produced, waste_rate=0.0)
        assert consumed[0] == 50_000.0

    def test_consumed_always_gt_produced(self):
        produced = [38_647.74]  # VIPA reference Y1
        consumed = compute_qty_consumed(produced, 0.01)
        assert consumed[0] > produced[0]


class TestPurchasesAndStockMP:
    def test_13_over_12_multiplier(self):
        """With SI=0, purchased = consumed × 13/12"""
        consumed = [12_000.0]
        purchased, closing, opening = compute_purchases_and_stock_mp(
            consumed, opening_stock_mp_y0=0.0
        )
        assert abs(purchased[0] - 12_000.0 * PURCHASE_MULTIPLIER) < 0.01

    def test_closing_stock_equals_one_month(self):
        """Closing MP stock should ≈ 1 month of consumption"""
        consumed = [120_000.0]    # 10_000/month
        purchased, closing, _ = compute_purchases_and_stock_mp(consumed, 0.0)
        expected_one_month = consumed[0] / 12
        assert abs(closing[0] - expected_one_month) < 1.0

    def test_opening_stock_carried_forward(self):
        """Year 2 opening stock = year 1 closing stock"""
        consumed = [12_000.0, 13_000.0]
        purchased, closing, opening = compute_purchases_and_stock_mp(consumed, 0.0)
        assert abs(opening[1] - closing[0]) < 0.01

    def test_new_project_zero_opening(self):
        consumed = [10_000.0, 11_000.0]
        _, _, opening = compute_purchases_and_stock_mp(consumed, 0.0)
        assert opening[0] == 0.0

    def test_purchases_not_negative(self):
        """Purchases must never go negative even with large opening stock"""
        consumed = [1_000.0]
        _, _, _ = compute_purchases_and_stock_mp(consumed, opening_stock_mp_y0=5_000.0)
        purchased, _, _ = compute_purchases_and_stock_mp(consumed, 5_000.0)
        assert purchased[0] >= 0.0


class TestInventoryChainVIPA:
    """End-to-end validation against VIPA Excel reference values."""

    def test_vipa_y1_full_chain(self):
        qty_sold = [VIPA_QTY_SOLD_Y1] * 7
        result = inventory_chain(
            qty_sold=qty_sold,
            stock_days_pf=VIPA_STOCK_DAYS_PF,
            selling_days=VIPA_SELLING_DAYS,
            waste_rate=VIPA_WASTE_RATE,
            mp_price_y1=VIPA_MP_PRICE_Y1,
        )
        # From Excel: PF Mais, Calcul Coût Ption sheet
        # qty_produced Y1 ≈ 38647 kg
        assert abs(result["qty_produced"][0] - 38_647.7) < 5.0

        # qty_consumed = 38647.7 × 1.01 ≈ 39034 kg
        assert abs(result["qty_consumed"][0] - 39_034.0) < 5.0

        # closing_stock_PF = 374400 × 10/310 ≈ 12077 sachets
        assert abs(result["closing_stock_pf"][0] - 12_077.4) < 5.0

        # closing_stock_MP ≈ 1 month = consumed/12 ≈ 3253 kg
        assert abs(result["closing_stock_mp"][0] - result["qty_consumed"][0] / 12) < 5.0

    def test_stock_balance_every_year(self):
        """closing_stock_MP[y] = purchased[y] − consumed[y]  for ALL years"""
        qty_sold = [VIPA_QTY_SOLD_Y1 * (1.15 ** y) for y in range(7)]
        result = inventory_chain(
            qty_sold=qty_sold,
            stock_days_pf=10,
            selling_days=310,
            waste_rate=0.01,
            mp_price_y1=2.80,
        )
        for y in range(7):
            balance = result["qty_purchased"][y] - result["qty_consumed"][y]
            assert abs(balance - result["closing_stock_mp"][y]) < 0.01, \
                f"Year {y+1}: stock balance mismatch"

    def test_opening_continuity_all_years(self):
        """opening_stock_MP[y] == closing_stock_MP[y-1] for y > 0"""
        qty_sold = [100_000 * (1.1 ** y) for y in range(7)]
        result = inventory_chain(
            qty_sold=qty_sold,
            stock_days_pf=10,
            selling_days=310,
            waste_rate=0.01,
            mp_price_y1=3.0,
        )
        for y in range(1, 7):
            assert abs(result["opening_stock_mp"][y] - result["closing_stock_mp"][y-1]) < 0.01

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — API exposure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to GET /api/plans/{id}/projections response:

  {
    "inventory": {
      "qtyProduced":    [38647, 44492, 51166, 58841, 67667, 67667, 67667],
      "qtyConsumed":    [39034, 44937, 51677, 59430, 68344, 68344, 68344],
      "qtyPurchased":   [42286, 45879, 52793, 60673, 69752, 62648, 62648],
      "closingStockPF": [12077, 13888, 15971, 18367, 21118, 21118, 21118],
      "closingStockMP": [ 3252,  3729,  4288,  4934,  5674,  5674,  5674],
      "openingStockMP": [    0,  3252,  3729,  4288,  4934,  5674,  5674],
      "purchaseValueMP": [118400, 128461, ...]
    }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — Frontend display ("Tableau de Bord Production")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a "Production & Stocks" tab to the /finance cockpit showing:

Table — rows = years Y1-Y7, columns:
  Quantité vendue | Quantité produite | Consommation MP | 
  Achats MP | Stock final MP | Stock final PF

Color coding:
  • closing_stock_MP[y] ≈ consumed[y]/12 → green (normal)
  • closing_stock_MP[y] < consumed[y]/24  → orange (understocked, < 15 days)
  • closing_stock_MP[y] > consumed[y]/6   → orange (overstocked, > 2 months)

Formula audit panel (collapsible):
  Show the actual formula being applied with real numbers for Year 1:
  "Quantité produite = 374 400 ventes + 12 077 stock PF = 386 477"
  "Consommation = 386 477 × 101% = 390 342"
  "Achats = (390 342 − 0 SI) × 13/12 = 422 870"
  "Stock final MP = 422 870 − 390 342 = 32 528 ≈ 1 mois"

Deliver:
  packages/bp_calc/bp_calc/inventory.py          ← new file
  packages/bp_calc/tests/test_inventory.py       ← new file
  packages/bp_schema/bp_schema/liasse.py         ← extend WorkingCapital + Operations + PlanResults
  packages/bp_calc/bp_calc/engine.py             ← integrate inventory_chain()
  api/routes/plans.py                            ← expose inventory series in /projections
  frontend/src/components/InventoryTable.tsx     ← new component
  frontend/src/app/finance/[id]/page.tsx         ← add "Production & Stocks" tab
```

---

## ⚡ Summary of What's Wrong vs. What's Needed

```
CURRENT (engine.py line 62-68):
  raw_c = units_by_year[y] × rawMaterialCost × 1.03^y
  ↑ This is a COST, not a QUANTITY. 
  ↑ No stock, no opening balance, no 13/12 Liasse formula.
  ↑ Waste applied to capacity (line 23-24), not to consumption.
  ↑ No 320/310 production day ratio anywhere.

NEEDED (inventory.py):
  qty_sold         → qty_produced (+ closing PF stock)
                   → qty_consumed (× 1.01 waste)
                   → qty_purchased ((consumed − SI) × 13/12)
                   → closing_stock_MP (= purchased − consumed ≈ 1 month)
                   → purchase_value (qty × price/unit)  → feeds P&L
                   → stock_value (qty × unit_cost)      → feeds balance sheet
```

**Breaking change risk:** LOW — the new quantity chain is additive.  
The existing capacity-based path remains as fallback when `qtySoldY1 = None`.  
Only plans that provide `qtySoldY1` will use the new chain.
