import { api } from "./api";

export type ProductUnit = "kg" | "sachet" | "unit" | "L" | "other";
export type CapacityBasis = "units_per_day" | "kg_per_month";

export interface PlanProduct {
  id: string;
  plan_id: string;
  name: string;
  unit: ProductUnit;
  unit_price_sell: number;
  ristourne_pct: number;
  monthly_qty_y1: number;
  sort_order: number;
  created_at?: string;
}

export interface RevenueAssumptions {
  plan_id: string;
  nominal_capacity: number;
  capacity_basis: CapacityBasis;
  production_days: number;
  growth_rate_y2: number;
  growth_rate_y3: number;
  growth_rate_y4: number;
  growth_rate_y5: number;
  growth_rate_y6: number;
  growth_rate_y7: number;
}

export interface ProductYearRevenue {
  year: number;
  quantity: number;
  revenue_gross: number;
  ristourne: number;
  revenue_net: number;
}

export interface ProductRevenueSeries {
  product_id: string;
  name: string;
  unit: string;
  years: ProductYearRevenue[];
}

export interface RevenueProjection {
  plan_id: string | null;
  products: ProductRevenueSeries[];
  total_revenue_gross: number[];
  total_revenue_net: number[];
  total_quantity: number[];
  capacity_utilization_pct: number[];
  nominal_capacity_annual: number;
}

export type PlanProductInput = {
  name: string;
  unit: ProductUnit;
  unit_price_sell: number;
  ristourne_pct: number;
  monthly_qty_y1: number;
  sort_order?: number;
};

export async function listProducts(planId: string): Promise<PlanProduct[]> {
  return api(`/plans/${planId}/products`);
}

export async function createProduct(
  planId: string,
  body: PlanProductInput
): Promise<PlanProduct> {
  return api(`/plans/${planId}/products`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateProduct(
  planId: string,
  productId: string,
  body: Partial<PlanProductInput>
): Promise<PlanProduct> {
  return api(`/plans/${planId}/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(planId: string, productId: string): Promise<void> {
  await api(`/plans/${planId}/products/${productId}`, { method: "DELETE" });
}

export async function getRevenueAssumptions(planId: string): Promise<RevenueAssumptions> {
  return api(`/plans/${planId}/revenue-assumptions`);
}

export async function updateRevenueAssumptions(
  planId: string,
  body: Partial<RevenueAssumptions>
): Promise<RevenueAssumptions> {
  return api(`/plans/${planId}/revenue-assumptions`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getRevenueProjection(
  planId: string,
  sync = true
): Promise<RevenueProjection> {
  return api(`/plans/${planId}/revenue-projection?sync=${sync ? "true" : "false"}`);
}

export async function queueRevenueProjection(planId: string): Promise<{ id: string; status: string }> {
  return api(`/plans/${planId}/revenue-projection`, { method: "POST" });
}

export function utilizationBarColor(pct: number): string {
  if (pct > 95) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}
