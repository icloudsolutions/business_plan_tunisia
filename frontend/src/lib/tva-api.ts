import { api } from "./api";
import { getToken } from "./auth-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface TvaConfigRow {
  id: string;
  plan_id: string;
  category: string;
  applies_to: string;
  label: string;
  tva_rate_purchase: number;
  tva_rate_sales: number;
  enabled: boolean;
  sort_order: number;
}

export interface TvaYearBalance {
  year: number;
  tva_collectee: number;
  tva_deductible: number;
  solde_tva: number;
  is_credit: boolean;
  sales_ht: number;
  sales_ttc: number;
  purchases_ht: number;
  purchases_ttc: number;
  supplier_payables: number;
  customer_receivables: number;
  collectee_by_line: Record<string, number>;
  deductible_by_line: Record<string, number>;
}

export interface TvaProjection {
  by_year: TvaYearBalance[];
  collectee_series: number[];
  deductible_series: number[];
  solde_series: number[];
  supplier_payables_series: number[];
  customer_receivables_series: number[];
}

export const TVA_RATE_OPTIONS = [
  { value: 0.06, label: "6 %" },
  { value: 0.07, label: "7 %" },
  { value: 0.13, label: "13 %" },
  { value: 0.18, label: "18 %" },
  { value: 0.19, label: "19 %" },
  { value: 0, label: "0 %" },
];

/** Label for a stored decimal rate (0.19 → "19 %"). */
export function tvaRateLabel(rate: number): string {
  const hit = TVA_RATE_OPTIONS.find((o) => Math.abs(o.value - rate) < 0.0001);
  if (hit) return hit.label;
  return `${(rate * 100).toLocaleString("fr-TN", { maximumFractionDigits: 2 })} %`;
}

export async function listTvaConfig(planId: string): Promise<TvaConfigRow[]> {
  return api(`/plans/${planId}/tva/config`);
}

export async function updateTvaConfig(
  planId: string,
  items: {
    id: string;
    label?: string;
    tva_rate_purchase?: number;
    tva_rate_sales?: number;
    enabled?: boolean;
  }[]
): Promise<TvaConfigRow[]> {
  return api(`/plans/${planId}/tva/config`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export async function getTvaProjection(planId: string): Promise<TvaProjection> {
  const res = await api<{ projection: TvaProjection }>(`/plans/${planId}/tva/projection`);
  return res.projection;
}

export async function downloadTvaExport(
  planId: string,
  format: "csv" | "html" = "csv"
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/plans/${planId}/tva/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (format === "html") {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = `tva_${planId}.csv`;
    a.click();
  }
  URL.revokeObjectURL(url);
}
