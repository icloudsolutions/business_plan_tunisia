import { api } from "@/lib/api";

export type PricingGridRow = {
  id: string;
  plan_id: string;
  product_id: string;
  purchase_price_per_kg: number;
  sell_price_per_unit: number;
  sell_price_per_kg: number;
  market_retail_price: number;
  ristourne_pct: number;
  unit_weight_g: number;
};

export type PricingRowComputed = {
  product_id: string;
  product_name: string;
  unit: string;
  purchase_price_per_kg: number;
  sell_price_per_unit: number;
  sell_price_per_kg: number;
  market_retail_price: number;
  ristourne_pct: number;
  unit_weight_g: number;
  price_to_reseller: number;
  gross_margin_per_kg: number;
  gross_margin_unit: number;
  gross_margin_pct: number | null;
  gross_margin_vs_market: number;
  competitiveness_ratio: number | null;
  below_market_pct: number | null;
  margin_band: "red" | "orange" | "green" | "unknown";
  is_competitive: boolean;
};

export type PricingChartBar = {
  product_id: string;
  product_name: string;
  cost: number;
  producer_margin: number;
  reseller_margin: number;
  shelf_price: number;
};

export type PricingProjection = {
  plan_id: string | null;
  rows: PricingRowComputed[];
  chart_bars: PricingChartBar[];
  grid: PricingGridRow[];
};

export async function fetchPricing(planId: string): Promise<PricingProjection> {
  const res = await api<{ projection: PricingProjection }>(`/plans/${planId}/pricing`);
  return res.projection;
}

export async function updatePricingRow(
  planId: string,
  rowId: string,
  body: Partial<
    Pick<
      PricingGridRow,
      | "purchase_price_per_kg"
      | "sell_price_per_unit"
      | "market_retail_price"
      | "ristourne_pct"
      | "unit_weight_g"
    >
  >
): Promise<PricingGridRow> {
  return api<PricingGridRow>(`/plans/${planId}/pricing-grid/${rowId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function syncPricingFromProducts(
  planId: string
): Promise<{ message: string; projection: PricingProjection }> {
  return api(`/plans/${planId}/pricing/sync-products`, { method: "POST" });
}

export function marginRowClass(band: PricingRowComputed["margin_band"]): string {
  switch (band) {
    case "red":
      return "bg-red-50/90";
    case "orange":
      return "bg-amber-50/80";
    case "green":
      return "bg-green-50/70";
    default:
      return "bg-white";
  }
}
