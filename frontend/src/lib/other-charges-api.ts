import { api } from "./api";

export type OtherChargeRuleType =
  | "pct_revenue"
  | "pct_investment"
  | "pct_payroll"
  | "fixed_inflation";

export interface OtherChargesConfigRow {
  id: string;
  plan_id: string;
  category: string;
  rule_type: OtherChargeRuleType;
  base_value: number;
  rate_or_pct: number;
  inflation_rate: number;
  enabled: boolean;
  sort_order: number;
}

export interface OtherChargesSettings {
  plan_id: string;
  lf2012_exemption_5y: boolean;
}

export interface OtherChargesYearSummary {
  year: number;
  total: number;
  by_category: Record<string, number>;
}

export interface OtherChargesProjection {
  lf2012_exemption_5y: boolean;
  investment_total: number;
  revenue_series: number[];
  payroll_series: number[];
  by_year: OtherChargesYearSummary[];
  total_series: number[];
}

export const CATEGORY_LABELS_FR: Record<string, string> = {
  maintenance: "Frais de maintenance / entretien",
  management: "Frais de gestion (télécoms, poste)",
  transport: "Transport sur vente",
  advertising: "Dépenses publicitaires",
  rent: "Loyer",
  fees: "Honoraires (audit, avocat)",
  travel: "Voyages & déplacements",
  insurance: "Assurance",
  tfp: "TFP (taxe formation prof.)",
  foprolo: "FOPROLOS",
  tcl: "TCL",
};

export const RULE_OPTIONS: { value: OtherChargeRuleType; label: string }[] = [
  { value: "pct_revenue", label: "% du CA" },
  { value: "pct_investment", label: "% de l'investissement" },
  { value: "pct_payroll", label: "% masse salariale" },
  { value: "fixed_inflation", label: "Forfait + inflation" },
];

export async function listOtherChargesConfig(
  planId: string
): Promise<OtherChargesConfigRow[]> {
  return api(`/plans/${planId}/other-charges/config`);
}

export async function updateOtherChargesConfig(
  planId: string,
  items: {
    id: string;
    rule_type?: OtherChargeRuleType;
    base_value?: number;
    rate_or_pct?: number;
    inflation_rate?: number;
    enabled?: boolean;
  }[]
): Promise<OtherChargesConfigRow[]> {
  return api(`/plans/${planId}/other-charges/config`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export async function getOtherChargesSettings(
  planId: string
): Promise<OtherChargesSettings> {
  return api(`/plans/${planId}/other-charges/settings`);
}

export async function updateOtherChargesSettings(
  planId: string,
  patch: { lf2012_exemption_5y?: boolean }
): Promise<OtherChargesSettings> {
  return api(`/plans/${planId}/other-charges/settings`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function getOtherChargesProjection(
  planId: string
): Promise<OtherChargesProjection> {
  const res = await api<{ projection: OtherChargesProjection }>(
    `/plans/${planId}/other-charges/projection`
  );
  return res.projection;
}

export async function syncOtherChargesToLiasse(planId: string): Promise<{
  message: string;
  other_operating_charges_y1: number;
}> {
  return api(`/plans/${planId}/other-charges/sync-liasse`, { method: "POST" });
}
