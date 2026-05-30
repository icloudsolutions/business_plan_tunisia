# 📊 Missing Features — Derived from Excel Business Plan Analysis
**Source file:** `output_example_Business plan VIPA VDEF 1 MOM.xlsx`  
**29 sheets analyzed** · Platform: business_plan_tunisia (Next.js + FastAPI + Celery)

---

## 🔍 Excel Sheets Inventory vs. Platform Coverage

| # | Excel Sheet | What it contains | Platform status |
|---|---|---|---|
| 1 | **Données** | Production capacity, payment delays, raw material prices, sales simulation | ❌ Not modelled |
| 2 | **Hypothèse** | TVA regime, production/consumption ratios, stock hypotheses | ❌ Not modelled |
| 3 | **Schémas fin** | Financing structure (equity vs. loan %) | ⚠️ Partial |
| 4 | **Investissements** | Asset list, depreciation schedule, breakdowns | ⚠️ Partial |
| 5 | **Prix achat-ventes** | Buy/sell price grid per product, market price comparison | ❌ Not modelled |
| 6 | **Chiffre d'affaire** | 7-year revenue by product with growth rates, capacity utilization % | ⚠️ Partial |
| 7 | **Calcul Coût Ption** | Unit cost build-up per product (MP + aromes + packaging + utilities + labor + amort + waste) | ❌ Not modelled |
| 8 | **Cout de production prévisionnel** | 7-year production costs with stock variation | ❌ Not modelled |
| 9 | **Taux de marge** | Gross margin rate per product per year | ❌ Not modelled |
| 10 | **Consommations Q** | Quantity consumed per raw material per product | ❌ Not modelled |
| 11 | **Ach prévisionnel** | Forecast purchases by category over 7 years | ❌ Not modelled |
| 12 | **Achat Matière** | Raw material purchase detail | ❌ Not modelled |
| 13 | **TVA** | Full VAT reconciliation (input/output by category) | ❌ Not modelled |
| 14 | **Achat carton** | Packaging/carton purchases | ❌ Not modelled |
| 15 | **Autres charges** | Operating expenses with 11 sub-categories and % rules | ❌ Not modelled |
| 16 | **SALAIRE** | Staff plan: 8 roles, headcount evolution, CNSS, imputable vs non-imputable | ❌ Not modelled |
| 17 | **P&L** | Full income statement over 7 years | ⚠️ Computed but not displayed live |
| 18 | **ACTIFS** | Balance sheet assets | ⚠️ Computed but not displayed live |
| 19 | **PASSIFS** | Balance sheet liabilities | ⚠️ Computed but not displayed live |
| 20 | **BG** | Full balance sheet (bilan général) | ⚠️ Computed but not displayed live |
| 21 | **Emprunt** | Quarterly loan amortization schedule with interest | ❌ Not modelled |
| 22 | **Trésor prévisionnelle** | Annual cash flow statement with BFR variation | ⚠️ Partial |
| 23 | **VAN** | NPV calculation, discounted cash flows, cumulative | ⚠️ Computed only |
| 24 | **frais financier** | Net financial charges per year | ❌ Not modelled |
| 25 | **INDICE DE RENTABILITE** | TIR=34.4%, VAN=796K DT, DRCI=2 ans 11 mois, TRC, IP | ⚠️ Numbers exist, no UI |
| 26 | **Analyse rentabilité** | Profitability ratios vs. revenue over 7 years | ❌ Not modelled |
| 27 | **CALCUL VANT TRI** | Detailed NPV+TRI computation | ⚠️ Black-box |
| 28 | **Shémas de réalisation** | Implementation timeline (Gantt-style) | ❌ Not modelled |
| 29 | **Feuil1** | Scratch sheet | — |

**Summary: 16 sheets completely absent from platform · 8 partially covered · 5 computed but hidden**

---

## 🚀 Missing Feature Prompts (Excel-derived)

---

### PROMPT A — Multi-Product Revenue Engine with Capacity Utilization

**Gap:** The Excel's `Chiffre d'affaire` + `Données` sheets model revenue per product SKU with monthly quantity × price × discount, then apply a 15%/year growth rate. The platform has no product-level revenue breakdown.

```
Implement a multi-product revenue module for the business plan platform.

Data model (add to bp_schema):
- products: id, plan_id, name, unit (kg/sachet/unit), unit_price_sell, 
  ristourne_pct (discount %), monthly_qty_y1
- revenue_assumptions: plan_id, growth_rate_y2..y7 (one per year, 
  can differ per year), capacity_utilization_y1..y7 (%)

Business logic (add to bp_calc):
- Annual revenue per product per year:
    qty_annual = monthly_qty * 12 * (production_days/310)
    revenue_gross = qty_annual * unit_price
    ristourne = revenue_gross * ristourne_pct
    revenue_net = revenue_gross - ristourne
- Apply compound growth rate year over year (Y2 = Y1 * (1 + rate_y2), etc.)
- Capacity utilization % = qty_produced / nominal_capacity
- Aggregate across all products for total CA per year

Frontend (Next.js):
- "Produits & Prix" section in the Liasse wizard:
  - Add/remove product rows (name, monthly qty Y1, sell price, discount %)
  - Nominal capacity input (units/day or kg/month)
  - Growth rate inputs: one slider per year Y2→Y7 (default 15%)
- Live preview table: shows revenue projection Y1–Y7 per product, 
  total row, and capacity utilization % bar per year
- Color coding: green if utilization < 80%, orange 80-95%, red > 95%

API:
- POST /api/plans/{id}/products (CRUD)
- GET /api/plans/{id}/revenue-projection (triggers Celery calc)

Deliver: bp_schema Pydantic models + bp_calc revenue engine + 
FastAPI endpoints + React product table + 7-year revenue grid
```

---

### PROMPT B — Unit Cost Build-Up Calculator (Coût de Production)

**Gap:** The `Calcul Coût Ption` sheet builds unit cost from 9 components per product: raw material (MP), aromes, packaging, gas, electricity, water, labor (per kg), depreciation (per kg), waste (1%). This granularity is entirely absent from the platform.

```
Implement a unit cost calculator per product in the business plan platform.

Cost components (from Excel analysis):
1. Achat MP (raw material per kg) — from price grid
2. Achats Aromes (flavor additives per kg) — % of MP
3. Achat Emballage (packaging per unit weight) — price/kg × gram/unit
4. Gaz, Électricité, Eau — utility cost per kg produced (entered as total 
   monthly bill then allocated pro-rata to production volume)
5. Main d'œuvre — total payroll / total kg produced
6. Amortissement machine — total machine depreciation / total annual production
7. Déchets — waste rate % × MP cost

Data model (bp_schema):
- cost_components: plan_id, product_id, year, mp_price_per_kg, 
  arome_rate_pct, packaging_g_per_unit, packaging_price_per_kg,
  gas_monthly, electricity_monthly, water_monthly,
  waste_pct

Business logic (bp_calc):
- unit_cost = mp + arome + packaging + (utilities / production_kg) 
              + (payroll / production_kg) + (depreciation / production_kg)
              + (waste_pct * mp)
- gross_margin_per_unit = sell_price - unit_cost
- gross_margin_rate = gross_margin / sell_price

Frontend:
- "Coûts de Production" section in wizard:
  - Per-product cost breakdown form (7 editable rows per product)
  - Auto-fill labor and depreciation from SALAIRE and Investissements 
    sections already entered
  - Live unit cost card per product: donut chart showing 
    cost component breakdown (MP%, Packaging%, Utilities%, Labor%, Amort%)
  - Margin summary table: cost vs. price vs. margin rate per product
  - Alert if margin rate < 20% (configurable threshold)

Deliver: bp_calc cost engine + React cost breakdown form 
+ per-product cost donut chart
```

---

### PROMPT C — Payroll Module (Plan de Masse Salariale)

**Gap:** The `SALAIRE` sheet has a full HR plan: 8 job functions, headcount per year, gross salary, 6% annual raise, CNSS (18.97%), distinction between "imputable" (production) and "non-imputable" (overhead) staff. None of this is modelled in the platform.

```
Build a complete payroll planning module for the business plan platform.

Data model (bp_schema):
- staff_roles: id, plan_id, function_name, qualification, 
  is_production_imputable (bool), base_monthly_salary
- headcount_plan: staff_role_id, year (1-7), headcount
- payroll_assumptions: plan_id, annual_raise_rate (default 6%), 
  cnss_employer_rate (default 18.97%)

Business logic (bp_calc):
- annual_gross = base_monthly_salary * 12 * headcount_year_n
- raise_compound: year_n_salary = year_1_salary * (1 + raise_rate)^(n-1)
- cnss = annual_gross * cnss_employer_rate
- total_payroll = annual_gross + cnss
- imputable_labor_cost = sum(roles where is_production_imputable) 
  → feeds into unit cost per kg
- non_imputable_labor_cost = sum(rest) → feeds into Autres Charges

Frontend ("Ressources Humaines" wizard section):
- Staff table: add/remove rows (function, qualification, salary, headcount Y1)
- Headcount evolution: per role, specify headcount for each year Y1-Y7 
  (default = Y1 headcount carried forward)
- Toggle: "Imputable production" / "Non imputable"
- Annual raise rate: global slider (default 6%) + per-role override
- Summary cards: Total headcount Y1-Y7 chart (bar), 
  Total payroll cost Y1-Y7, 
  CNSS cost per year,
  Imputable vs. Non-imputable split (stacked bar)
- Export: generate payroll summary table for insertion into Liasse PDF

Deliver: bp_schema HR models + bp_calc payroll engine + 
React staff table with year-by-year headcount + payroll summary charts
```

---

### PROMPT D — Operating Expenses Module (Autres Charges d'Exploitation)

**Gap:** The `Autres charges` sheet has 11 expense categories, each computed by a specific rule (% of revenue, % of investment cost, fixed+inflation, etc.). The platform has no structured other-charges input.

```
Implement a structured operating expenses module with formula-driven rules.

Expense categories and their computation rules (from Excel):
1. Frais de maintenance / entretien   → 4% of total investment cost
2. Frais de gestion (télécoms, poste) → 0.5% of revenue
3. Transport sur vente                → 3% of revenue  
4. Dépenses publicitaires             → 3.5% of revenue
5. Loyer                              → fixed amount, +5%/year inflation
6. Honoraires (audit, avocat)         → fixed amount, +5%/year
7. Voyages & déplacements             → fixed amount, +5%/year
8. Assurance                          → fixed or 0.11% of revenue, +3%/year
9. TFP (taxe formation prof.)         → 1% of payroll
10. FOPROLOS                          → 1% of payroll
11. TCL                               → 0.2% of revenue (TTC)

Data model (bp_schema):
- other_charges_config: plan_id, category, rule_type 
  (pct_revenue | pct_investment | fixed_inflation), 
  base_value, rate_or_pct, inflation_rate

Business logic (bp_calc):
- For each category, apply rule against linked computed values 
  (revenue, investment, payroll from other modules)
- Sum per year Y1-Y7
- Flag: TFP + FOPROLOS are exempt for first 5 years (LF 2012 Tunisian law)

Frontend ("Autres Charges" wizard section):
- Editable table with one row per expense category
- Rule selector: "% du CA" / "% de l'investissement" / "Forfait + inflation"
- For fixed rules: base amount field + annual inflation rate
- For % rules: percentage field (editable, pre-filled with defaults above)
- Special note on TFP/FOPROLOS: "Exonération 5 ans — LF 2012" checkbox 
  that zeroes these for Y1-Y5
- Live 7-year projection table (auto-calculates)
- Total row: sum all categories per year

Deliver: bp_schema config model + bp_calc engine + React expense table
```

---

### PROMPT E — Full VAT Reconciliation Module (Tableau TVA)

**Gap:** The `TVA` sheet is one of the most complex — it reconciles input VAT (on purchases) against output VAT (on sales) for every category (products, raw materials, packaging, aromes, investments, operating charges) across 7 years, applying different TVA rates per category. Completely absent from the platform.

```
Implement a full TVA reconciliation module for Tunisian fiscal compliance.

TVA rates from the Excel (Liasse Unique rules):
- Maïs products: 6% on purchases, production, sales (Code TVA Tableau B §I.11)
- Other dried fruits (noisette, pistache, etc.): 
  6% at transformation stage, 18% on retail sales
- Imported equipment: 6% (Code TVA Tableau B bis §I.3.a)
- Packaging materials: 18%
- Aromes: 18%
- Cartons: 18%
- Operating charges (marketing, transport, rent, etc.): 18%

Data model (bp_schema):
- tva_config: plan_id, category, tva_rate_purchase, tva_rate_sales, 
  applies_to (product_id | 'all_equipment' | 'packaging' | 'other_charges')

Business logic (bp_calc):
- TVA collectée (output) = sum(revenue_net_per_category * tva_rate_sales)
- TVA déductible (input) = sum(purchases_per_category * tva_rate_purchase)
- Solde TVA = TVA collectée - TVA déductible  (if negative → TVA credit)
- Produce full TVA table: HT | TVA | TTC for each line item per year

Frontend ("TVA & Fiscalité" section):
- TVA rate configuration per product category (pre-filled with defaults)
- Annual TVA balance table showing:
  - TVA collectée par catégorie de vente
  - TVA déductible par catégorie d'achat
  - Solde TVA net (credit shown in green, debit in red)
- Visual: waterfall chart of TVA flows Y1-Y7
- Export: Tableau TVA formatted per Liasse Unique requirements

Note: Also compute supplier payables balance (solde fournisseurs = 
1 month of purchases TTC) and customer receivables (1 month of sales TTC).

Deliver: bp_schema TVA models + bp_calc TVA engine + 
React TVA reconciliation table + waterfall chart
```

---

### PROMPT F — Loan Amortization Schedule (Tableau d'Emprunt)

**Gap:** The `Emprunt` sheet has a full quarterly amortization table (28 rows) with balance, principal repayment, interest calculation at 8.3% for a 420,000 DT loan over 7 years starting with a 12-month grace period. The platform has no loan modelling UI.

```
Build a loan amortization calculator and schedule display.

Loan parameters (from Excel):
- Loan amount (Montant de l'emprunt): entered in Financement section
- Interest rate (Taux d'intérêt): default 8.3% (configurable)
- Term in years: default 7
- Grace period: number of months before principal repayment starts 
  (default 12 months — interest-only period)
- Repayment frequency: quarterly (default) or annual

Business logic (bp_calc):
- Generate quarterly amortization table:
  - During grace period: annuity = interest only (balance * rate/4)
  - After grace period: equal principal installments
  - interest_t = balance_t * rate/4
  - principal_t = total_principal / (total_quarters - grace_quarters)
  - balance_t+1 = balance_t - principal_t
- Annual aggregates: sum of principal + interest per calendar year
- Feed into:
  - P&L: annual interest expense per year
  - Cash flow: annual debt service (principal + interest)
  - Balance sheet: remaining loan balance per year-end

Data model (bp_schema):
- loan: id, plan_id, lender_name, amount, rate, term_years, 
  grace_months, start_date, frequency

Frontend ("Financement" wizard section):
- Loan input card: amount, rate, term, grace period, start date
- Instant amortization table (lazy-rendered in a scrollable grid):
  Columns: Period # | Date | Solde Initial | Annuité | Principal | Intérêt | Solde Final
  Highlighted rows: grace period in light blue, principal repayment years in white
- Annual summary pivot: columns = years, rows = Capital Restant Dû / Intérêts / Principal
- Visual: dual-axis line chart (principal outstanding left, interest charge right) over 7 years
- Multiple loans: support up to 3 loan tranches (e.g., CMT + leasing)

Deliver: bp_calc amortization engine + React amortization table 
+ annual loan summary + dual-axis chart
```

---

### PROMPT G — Full Balance Sheet Display (Bilan Général)

**Gap:** The `ACTIFS`, `PASSIFS`, and `BG` sheets contain a complete 7-year balance sheet. The platform's Celery worker likely produces these numbers, but there is no UI to display or input them.

```
Implement a 7-year balance sheet viewer integrated with the live calc engine.

Balance sheet structure (from Excel):

ACTIFS (Assets):
  Immobilisations nettes (fixed assets):
    - Immobilisations incorporelles (software, prelim expenses)
    - Immobilisations corporelles (machinery, transport, furniture)
    - Less: cumulated depreciation per asset
  Actifs courants (current assets):
    - Stocks MP + aromes + emballage + PF (from purchase/production modules)
    - Créances clients (revenue * client_payment_delay/360)
    - Trésorerie (from cash flow statement)

PASSIFS (Liabilities + Equity):
  Capitaux propres (equity):
    - Capital social (from financing section)
    - Résultats cumulés (accumulated net income)
  Dettes à long terme:
    - Emprunts (from amortization module)
  Dettes à court terme:
    - Dettes fournisseurs (purchases * supplier_payment_delay/360)
    - TVA à payer (from TVA module)

Business logic: already in bp_calc — expose via API endpoint 
GET /api/plans/{id}/balance-sheet

Frontend ("Bilan Prévisionnel" tab in finance cockpit):
- Year selector: tabs for Y1 → Y7
- Two-column layout: ACTIFS (left) | PASSIFS (right)
- Each section expandable to show line items
- Balance check indicator: "Bilan équilibré ✓" or "Écart: X DT ⚠️"
- Horizontal stacked bar showing asset composition evolution Y1-Y7:
  Fixed assets (depreciating) vs. Current assets (growing with revenue)
- Key ratios calculated live:
  - Ratio d'endettement = dettes LT / capitaux propres
  - Ratio de liquidité = actifs courants / dettes CT
  - Fonds de roulement = capitaux permanents - actifs immobilisés
  - BFR = stocks + créances - dettes fournisseurs
  - Trésorerie nette = FDR - BFR

Deliver: FastAPI balance-sheet endpoint + React balance sheet viewer 
+ KPI ratio cards + composition bar chart
```

---

### PROMPT H — Cash Flow Statement with BFR Dynamics

**Gap:** The `Trésor prévisionnelle` sheet has a complete annual cash flow statement including BFR variation (calculated as 33 days of TTC revenue), initial BFR investment, debt service, and cumulative treasury. The platform's `/finance` page uses mock data.

```
Build a real annual cash flow statement connected to the calc engine.

Cash flow components (from Excel):
  Receipts:
    - Cash flows d'exploitation (net income + depreciation)
    - Fonds propres (year 0 only)
    - Dettes (loan drawdown, year 0 only)
  Payments:
    - Investissement Initial (year 0)
    - Variation du BFR: BFR_n - BFR_(n-1)
      where BFR = (CA TTC / 360) * client_days + stocks - supplier_credit
    - Remboursement dettes en principal (from amortization module)
    - Récupération BFR (terminal year: BFR returned)
    - VCN des immobilisations (terminal year: net book value)

BFR calculation from Excel:
  BFR = client_receivables + stocks - supplier_payables
  In the Excel: BFR = 33 days of TTC revenue (compact formula)
  Target: compute it properly from the three components

Frontend ("Trésorerie" tab in finance cockpit):
1. Annual cash flow table (Y0 through Y7):
   - Rows: Exploitation CF | Variation BFR | Investissement | Dettes | 
     Trésorerie nette | Trésorerie cumulée
   - Color-code: positive cells green, negative cells red
2. Waterfall chart: shows Y0 investment outflow, then yearly CF bars 
   going positive, cumulative line overlaid
3. BFR evolution chart: stacked area — stocks + créances - fournisseurs
4. "Point d'équilibre de trésorerie": annotation on the cumulative line 
   showing when cumulative treasury crosses zero
5. Sensitivity analysis: slider for BFR assumption (days of revenue: 
   20 / 33 / 45) and watch treasury chart recompute in real time

Deliver: bp_calc BFR + cashflow engine update + React cashflow table 
+ waterfall chart + BFR area chart
```

---

### PROMPT I — Complete KPI Dashboard (Rentabilité & Indicateurs)

**Gap:** The `INDICE DE RENTABILITE` sheet shows TIR=34.4%, VAN=796,118 DT, DRCI=2 ans 11 mois, TRC=37%, IP=1.85. The `Analyse rentabilité` sheet tracks EBIT, net income, and revenue evolution. These are computed but not surfaced in any UI panel.

```
Build a complete financial KPI dashboard as the plan's "home page" 
once calculations are available.

KPIs to display (from Excel):

1. PRIMARY INVESTMENT KPIs (large hero cards):
   - VAN (NPV) at 10% discount rate — with tooltip explaining the rate assumption
   - TRI (IRR) — color-coded: green if > 15%, orange 10-15%, red < 10%
   - DRCI (Payback period) — in years + months format (e.g., "2 ans 11 mois")
   - IP (Profitability Index) = VAN / Investment
   - TRC (Accounting Rate of Return)

2. ANNUAL PERFORMANCE KPIs (trend line per year Y1-Y7):
   - Chiffre d'affaires net
   - Résultat d'exploitation (EBIT)
   - Résultat net (PAT)
   - Marge brute %
   - Marge nette %
   - EBE (EBITDA) = Résultat exploit + Amortissements

3. CAPACITY & EFFICIENCY:
   - Taux d'utilisation capacité Y1-Y7 (% of nominal capacity used)
   - Point mort (break-even revenue) — computed as Fixed Costs / Gross Margin Rate
   - Distance to break-even Y1 (how far above break-even)

4. FINANCING RATIOS:
   - Ratio d'endettement par année
   - Couverture du service de la dette (DSCR) = EBITDA / Debt Service
   - Capital restant dû par année

Frontend design:
- Hero section: 5 large KPI cards (VAN / TRI / DRCI / IP / TRC) 
  with color status indicators
- Below: 4 charts in 2×2 grid:
  • Revenue + Profit trend (line chart, dual-axis)
  • Margin rates by year (grouped bar: gross / net margin %)
  • Capacity utilization (area chart Y1-Y7)
  • Debt coverage (bar chart: EBITDA vs. debt service)
- "Point mort" callout: "Votre seuil de rentabilité est atteint à X DT 
  de CA — vous êtes à Y% au-dessus en Y1"
- Status badge: Finançable ✓ / Non finançable ✗ based on:
  VAN > 0 AND TRI > discount_rate AND DRCI < plan_term AND DSCR > 1.2

Deliver: bp_calc KPI engine + FastAPI /kpis endpoint + 
React KPI dashboard with Recharts
```

---

### PROMPT J — Gantt / Implementation Timeline (Schémas de Réalisation)

**Gap:** The `Shémas de réalisation` sheet models the project startup timeline — showing when investments happen, when production starts (90-day startup delay), and how the business phases in. No Gantt or timeline view exists in the platform.

```
Add an implementation timeline (Gantt chart) module to the business plan.

Data model (bp_schema):
- timeline_phases: id, plan_id, name, start_date, end_date, 
  phase_type (investment | startup | production | commercial), color
- Default phases auto-generated from plan data:
  Phase 1: Financement et constitution (months 1-2)
  Phase 2: Acquisition équipements (months 2-4)  
  Phase 3: Installation et aménagement (months 3-5)
  Phase 4: Formation du personnel (months 4-5)
  Phase 5: Démarrage progressif (months 5-7, délai de démarrage = 90 days)
  Phase 6: Production normale (month 7 onward)

Frontend ("Planning de Réalisation" section):
- Interactive Gantt chart (horizontal bars):
  - X-axis: months 1-18 (configurable)
  - Y-axis: phases/tasks
  - Drag handles to adjust start/end dates
  - Color-coded by phase type
- Startup delay field: "Délai de démarrage: X jours" 
  (feeds into revenue calc as the delay before first sale)
- Milestones markers: key dates (first production day, break-even date, 
  loan first repayment)
- Export: PDF-ready Gantt for inclusion in Liasse package

Integration with calc engine:
- The startup delay from this module feeds into bp_calc 
  to reduce Year 1 revenue proportionally
  (if startup = 90 days → Y1 has only 275/365 = 75% of full-year revenue)

Deliver: bp_schema timeline model + React Gantt (d3-gantt or 
react-gantt-chart) + startup delay integration in bp_calc
```

---

### PROMPT K — Raw Material & Procurement Module

**Gap:** The `Consommations Q`, `Ach prévisionnel`, `Achat Matière`, `Achat carton` sheets model detailed procurement: quantities consumed per product per raw material, forecast annual purchases, and seasonal purchasing patterns. Not modelled in the platform.

```
Implement a complete procurement planning module.

Data model (bp_schema):
- raw_materials: id, plan_id, name, unit (kg/litre/unit), price_per_unit, 
  supplier_payment_days (default 30), tva_rate
- product_recipes: product_id, raw_material_id, quantity_per_kg_product
  (e.g., 1kg cacahuète product needs 1kg MP + 0.06kg aromes + 0.004kg packaging)
- purchase_assumptions: plan_id, raw_material_id, stock_days (e.g., 30 days)

Business logic (bp_calc):
- For each year, per raw material:
    annual_consumption = sum(product_qty_produced * recipe_qty_per_kg)
    closing_stock = annual_consumption * stock_days / 365
    purchases = annual_consumption + closing_stock - opening_stock
    purchase_value = purchases * price_per_unit
    supplier_payable = purchase_value * payment_days / 365  (→ balance sheet)
- Total annual purchases feed into:
    - P&L: Achats consommés
    - Balance sheet: Stocks + Dettes fournisseurs
    - TVA: déductible par catégorie

Frontend ("Approvisionnements" wizard section):
- Raw material list: add/remove materials (name, unit, price, TVA rate)
- Recipe matrix: for each product, enter grams of each ingredient per kg
  (e.g., PF Maïs: 1000g Maïs + 60g Aromes + 4g Emballage)
- Stock days assumption per material
- Annual procurement table: 
  Rows = materials, Columns = Y1-Y7 quantities + values
- Price evolution: option to apply annual price inflation per material
- Charts: 
  • Purchase composition donut (MP% vs. Aromes% vs. Packaging%)
  • Annual procurement cost trend (stacked area)

Deliver: bp_schema recipe models + bp_calc procurement engine + 
React recipe matrix + procurement table + composition chart
```

---

### PROMPT L — Financing Structure Module

**Gap:** The `Schémas fin` sheet shows equity=30% (180,000 DT) + CMT loan=70% (420,000 DT) = 600,000 DT total. The platform's Liasse forms likely capture this but do not validate the financing plan against the investment plan.

```
Build a comprehensive financing module with structure validation.

Data model (bp_schema):
- financing_sources: id, plan_id, source_type 
  (fonds_propres | cmt | leasing | subvention | autre),
  label, amount, rate (for loans), term_years, grace_months
- financing_summary: total_investment, total_financing, gap

Business logic:
- Validate: sum(financing_sources.amount) == total_investment 
  (including BFR initial)
- BFR initial = first-year BFR calculated from operations module
- Equity ratio = fonds_propres / total_financing 
  (banking standard: must be ≥ 25-30%)
- Debt ratio = loans / total_financing

Frontend ("Financement" wizard section):
1. Investment summary card (read from Investissements module):
   - Fixed assets total
   - BFR initial (auto-computed)
   - TOTAL BESOIN DE FINANCEMENT

2. Financing sources table:
   - Rows: Fonds propres | CMT Banque X | Leasing | Subvention BFPME/SICAR | Autre
   - Columns: Montant | % | Taux | Durée | Franchise
   - Running total and GAP indicator (must equal 0)

3. Financing structure donut chart:
   - Equity vs. Debt split with % labels
   - Benchmark overlay: "Standard bancaire: 25% min fonds propres"
   - Status: ✓ Conforme / ✗ Non conforme

4. Eligibility checker:
   Based on financing structure + VAN + TRI + DRCI, show which 
   Tunisian funding programs the project qualifies for:
   - BFPME (PME financing bank)
   - SICAR (venture capital)
   - BTS (tourism/SME credit)
   - SOTUGAR (guarantee fund)
   - FOPRODI
   Each shows eligibility criteria and whether plan meets them.

Deliver: bp_schema financing models + React financing panel 
+ eligibility checker component
```

---

### PROMPT M — Buy/Sell Price Grid with Market Comparison

**Gap:** The `Prix achat-ventes` sheet has a grid comparing buy price, sell price (to distributor), and market retail price per product — allowing the user to see their margin vs. the market. The platform has no price grid or competitive pricing UI.

```
Add a pricing module with competitive market comparison.

Data model (bp_schema):
- pricing_grid: id, plan_id, product_id, 
  purchase_price_per_kg, sell_price_per_unit, sell_price_per_kg,
  market_retail_price (competitor/shelf price),
  ristourne_pct (trade discount to resellers)

Business logic (bp_calc):
- price_to_reseller = sell_price_per_unit
- price_per_kg_sell = sell_price_per_unit / (unit_weight_g / 1000)
- gross_margin_per_kg = price_per_kg_sell - purchase_price_per_kg
- gross_margin_vs_market = market_retail_price - sell_price_per_unit
  (how much room resellers have — their margin)
- competitiveness_ratio = sell_price_per_unit / market_retail_price
  (should be < 1 to be competitive)

Frontend ("Prix de Vente" wizard section):
- Price grid table:
  Columns: Product | Prix achat/kg | Prix vente/unité | Prix vente/kg | 
           Prix marché | Ristourne % | Marge brute | Marge %
- Each row color-coded by margin rate (red < 10%, orange 10-25%, green > 25%)
- Market price input: user enters competitor/shelf price for reference
- Competitiveness indicator: "Votre prix est X% en dessous du marché" 
  (good if positive, warning if negative)
- Price sensitivity: slider to adjust sell price → see margin change live
- Chart: horizontal bar chart comparing price components 
  (cost + margin + reseller margin + shelf price)

Deliver: bp_schema pricing model + React price grid table 
+ price sensitivity slider + competitiveness chart
```

---

## 📋 Full Feature Gap Matrix

| Feature | Excel Sheet | Priority | Complexity | Depends On |
|---|---|---|---|---|
| Multi-product revenue engine | Chiffre d'affaire | 🔴 P1 | Medium | Données, Prix |
| Unit cost build-up | Calcul Coût Ption | 🔴 P1 | High | Salaire, Invest., Achats |
| Payroll module | SALAIRE | 🔴 P1 | Medium | — |
| KPI Dashboard | INDICE DE RENTABILITE | 🔴 P1 | Medium | All calc modules |
| Cash flow statement | Trésor prévisionnelle | 🔴 P1 | Medium | P&L, BFR, Emprunt |
| Operating expenses | Autres charges | 🟡 P2 | Low | Revenue, Investment |
| Balance sheet display | ACTIFS / PASSIFS / BG | 🟡 P2 | Medium | All calc modules |
| Loan amortization | Emprunt | 🟡 P2 | Low | Financing |
| Financing module | Schémas fin | 🟡 P2 | Low | Investment, BFR |
| TVA reconciliation | TVA | 🟡 P2 | High | All purchase/sale modules |
| Procurement module | Consommations Q, Ach prev | 🟠 P3 | High | Products, Recipes |
| Price grid / competitive | Prix achat-ventes | 🟠 P3 | Low | Products |
| Gantt / timeline | Shémas de réalisation | 🟠 P3 | Medium | — |

---

## 🔢 Key Financial Constants Found in Excel

These should be pre-loaded as configurable defaults in the platform:

```python
DEFAULTS = {
    # Fiscal (Tunisia-specific)
    "tva_rate_standard": 0.18,
    "tva_rate_food_basic": 0.06,          # Maïs, légumes secs
    "cnss_employer_rate": 0.1897,         # 18.97%
    "corporate_tax_rate": 0.25,           # IS (impôt sur les sociétés)
    "tfp_rate": 0.01,                     # Taxe formation professionnelle
    "foprolos_rate": 0.01,
    "tcl_rate": 0.002,                    # Taxe collectivités locales
    
    # Operations
    "working_days_per_year": 310,
    "startup_delay_days": 90,
    "client_payment_days": 30,
    "supplier_payment_days": 30,
    "stock_days_finished_goods": 10,
    "stock_days_raw_materials": 30,
    
    # Investment
    "depreciation_rate_software": 0.333,  # 33.3%
    "depreciation_rate_machinery": 0.10,  # 10%
    "depreciation_rate_transport": 0.20,  # 20%
    "depreciation_rate_furniture": 0.10,
    "depreciation_rate_prelim": 0.333,
    
    # Financing
    "loan_interest_rate": 0.083,          # 8.3% (CMT standard)
    "discount_rate_npv": 0.10,            # 10% for NPV
    "equity_ratio_minimum": 0.25,         # 25% minimum
    
    # Revenue
    "ristourne_rate": 0.10,               # 10% trade discount
    "annual_growth_rate_default": 0.15,   # 15% revenue growth
}
```

These constants must be:
1. Pre-seeded in the database when a plan is created
2. Editable per plan in an "Hypothèses" section of the wizard
3. Versioned (if expert changes a rate, log the change)
4. Shown with tooltips explaining their legal source

---

## 💡 Data Flow Architecture (Missing Link)

The Excel reveals a **one-way dependency chain** that `bp_calc` must respect:

```
Données (capacity, delays, prices)
    ↓
Hypothèse (TVA regime, ratios)
    ↓
Investissements → Amortissement schedule
    ↓
Financement → Emprunt → frais financier
    ↓
SALAIRE → Main d'œuvre / kg
    ↓
Prix achat-ventes → Calcul Coût Ption (unit cost per product)
    ↓
Chiffre d'affaire (revenue) + Cout de production prévisionnel
    ↓
Taux de marge (gross margin validation)
    ↓
Autres charges + TVA + Achat carton
    ↓
P&L (income statement)
    ↓
Trésor prévisionnelle (cash flow)  +  ACTIFS/PASSIFS/BG (balance sheet)
    ↓
VAN / TRI / DRCI / INDICE DE RENTABILITE
```

**The platform must enforce this order**: saving inputs in a later module before completing earlier ones should show a warning ("Veuillez d'abord compléter la section Investissements").

---

*Generated from deep analysis of 29 Excel sheets in the reference business plan*  
*Company: VIPA — agro-alimentaire (snacks/noix), Tunisie, 7-year horizon 2016-2022*
