import { api } from "./api";

export interface CostComponent {
  id: string;
  plan_id: string;
  product_id: string;
  year: number;
  mp_price_per_kg: number;
  arome_rate_pct: number;
  packaging_g_per_unit: number;
  packaging_price_per_kg: number;
  gas_monthly: number;
  electricity_monthly: number;
  water_monthly: number;
  waste_pct: number;
}

export interface CostAutofill {
  annual_payroll: number;
  annual_depreciation_y1: number;
  depreciation_by_year: number[];
  total_capex: number;
  suggested_mp_price_per_kg: number;
  suggested_packaging_price_per_kg: number;
  suggested_waste_pct: number;
  products: { product_id: string; name: string; unit: string }[];
}

export interface CostBreakdown {
  mp: number;
  arome: number;
  packaging: number;
  utilities: number;
  labor: number;
  depreciation: number;
  waste: number;
}

export interface ProductUnitCost {
  product_id: string;
  name: string;
  year: number;
  unit: string;
  sell_price: number;
  unit_cost: number;
  gross_margin_per_unit: number;
  gross_margin_rate: number | null;
  breakdown: CostBreakdown;
  breakdown_pct: Record<string, number>;
  margin_alert: boolean;
  weight_kg_per_unit: number;
}

export interface PlanCostProjection {
  plan_id?: string;
  year: number;
  margin_alert_threshold: number;
  allocation: {
    annual_payroll: number;
    annual_depreciation: number;
    total_production_kg: number;
  };
  products: ProductUnitCost[];
}

export type CostComponentInput = Omit<CostComponent, "id" | "plan_id"> & {
  product_id: string;
  year: number;
};

export async function listCostComponents(
  planId: string,
  year?: number
): Promise<CostComponent[]> {
  const q = year != null ? `?year=${year}` : "";
  return api(`/plans/${planId}/cost-components${q}`);
}

export async function upsertCostComponents(
  planId: string,
  items: Partial<CostComponentInput> & { product_id: string; year: number }[]
): Promise<CostComponent[]> {
  return api(`/plans/${planId}/cost-components`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export async function getCostAutofill(planId: string): Promise<CostAutofill> {
  return api(`/plans/${planId}/cost-autofill`);
}

export async function getUnitCostProjection(
  planId: string,
  year = 1
): Promise<{ year: number; projection: PlanCostProjection }> {
  return api(`/plans/${planId}/unit-cost-projection?year=${year}`);
}

export async function updateMarginThreshold(
  planId: string,
  threshold: number
): Promise<{ margin_alert_threshold: number }> {
  return api(`/plans/${planId}/cost-settings?margin_alert_threshold=${threshold}`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export const COST_ROW_KEYS = [
  { key: "mp_price_per_kg", label: "Achat MP (DT/kg)", pctKey: "mp" },
  { key: "arome_rate_pct", label: "Arômes (% MP)", pctKey: "arome", isPct: true },
  { key: "packaging_price_per_kg", label: "Emballage (DT/kg)", pctKey: "packaging" },
  { key: "packaging_g_per_unit", label: "Grammes / unité", pctKey: null },
  { key: "utilities", label: "Gaz + Élec + Eau (DT/mois)", pctKey: "utilities", combined: true },
  { key: "labor_hint", label: "Main d'œuvre (auto)", pctKey: "labor", readOnly: true },
  { key: "depreciation_hint", label: "Amortissement (auto)", pctKey: "depreciation", readOnly: true },
  { key: "waste_pct", label: "Déchets (% MP)", pctKey: "waste", isPct: true },
] as const;

export const DONUT_COLORS: Record<string, string> = {
  mp: "#1e3a5f",
  arome: "#3b82f6",
  packaging: "#d4a853",
  utilities: "#06b6d4",
  labor: "#8b5cf6",
  depreciation: "#64748b",
  waste: "#ef4444",
};
