import { api } from "@/lib/api";

export type RawMaterial = {
  id: string;
  plan_id: string;
  name: string;
  unit: string;
  category: "mp" | "arome" | "packaging" | "other";
  price_per_unit: number;
  supplier_payment_days: number;
  tva_rate: number;
  annual_price_inflation_pct: number;
  sort_order: number;
};

export type ProcurementProjection = {
  rows: {
    raw_material_id: string;
    name: string;
    unit: string;
    category: string;
    stock_days: number;
    years: {
      year: number;
      annual_consumption: number;
      purchases_qty: number;
      purchase_value_ht: number;
      supplier_payable: number;
      unit_price: number;
    }[];
  }[];
  chart_donut: { name: string; category: string; value: number; pct: number }[];
  chart_trend: { year: string; mp: number; arome: number; packaging: number; other: number; total: number }[];
  totals_by_year: { year: number; purchase_value_ht: number }[];
};

export async function fetchProcurement(planId: string): Promise<ProcurementProjection> {
  const res = await api<{ projection: ProcurementProjection }>(`/plans/${planId}/procurement`);
  return res.projection;
}

export async function listRawMaterials(planId: string): Promise<RawMaterial[]> {
  return api<RawMaterial[]>(`/plans/${planId}/raw-materials`);
}

export async function createRawMaterial(
  planId: string,
  body: Partial<RawMaterial>
): Promise<RawMaterial> {
  return api<RawMaterial>(`/plans/${planId}/raw-materials`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRawMaterial(
  planId: string,
  id: string,
  body: Partial<RawMaterial>
): Promise<RawMaterial> {
  return api<RawMaterial>(`/plans/${planId}/raw-materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteRawMaterial(planId: string, id: string): Promise<void> {
  await api(`/plans/${planId}/raw-materials/${id}`, { method: "DELETE" });
}

export async function saveRecipes(
  planId: string,
  entries: { product_id: string; raw_material_id: string; quantity_per_kg_product: number }[]
): Promise<ProcurementProjection> {
  const res = await api<{ projection: ProcurementProjection }>(
    `/plans/${planId}/procurement/recipes`,
    { method: "PUT", body: JSON.stringify({ entries }) }
  );
  return res.projection;
}

export async function savePurchaseAssumptions(
  planId: string,
  assumptions: { raw_material_id: string; stock_days: number }[]
): Promise<ProcurementProjection> {
  const res = await api<{ projection: ProcurementProjection }>(
    `/plans/${planId}/procurement/assumptions`,
    { method: "PUT", body: JSON.stringify({ assumptions }) }
  );
  return res.projection;
}

/** grams per kg finished product in UI → kg per kg for API */
export function gramsToKgPerKg(grams: number): number {
  return grams / 1000;
}

export function kgPerKgToGrams(kg: number): number {
  return kg * 1000;
}
