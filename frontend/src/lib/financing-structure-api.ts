import { api } from "@/lib/api";

export type FinancingSourceType =
  | "fonds_propres"
  | "cmt"
  | "leasing"
  | "subvention"
  | "autre";

export type FinancingSource = {
  id: string;
  plan_id: string;
  source_type: FinancingSourceType;
  label: string;
  amount: number;
  rate: number;
  term_years: number;
  grace_months: number;
  sort_order: number;
  loan_id: string | null;
};

export type FinancingSourceDetail = FinancingSource & {
  share_pct: number;
  is_equity?: boolean;
  is_debt?: boolean;
};

export type InvestmentBreakdown = {
  fixed_assets_total: number;
  initial_bfr: number;
  total_financing_need: number;
};

export type FinancingSummary = {
  total_investment: number;
  initial_bfr: number;
  total_financing_need: number;
  total_sources_amount: number;
  gap: number;
  is_balanced: boolean;
  equity_amount: number;
  debt_amount: number;
  subvention_amount: number;
  equity_ratio: number;
  debt_ratio: number;
  meets_bank_equity_minimum: boolean;
  min_equity_ratio_required: number;
  structure_status: string;
  structure_label: string;
};

export type EligibilityProgram = {
  key: string;
  name: string;
  description: string;
  criteria: string[];
  eligible: boolean;
  reasons: string[];
};

export type FinancingStructureProjection = {
  plan_id: string | null;
  investment: InvestmentBreakdown;
  summary: FinancingSummary;
  sources: FinancingSource[];
  sources_detail: FinancingSourceDetail[];
  chart_structure: { name: string; slice: string; value: number; pct: number }[];
  eligibility_programs: EligibilityProgram[];
  indicators: {
    van?: number;
    tri?: number;
    drci_years?: number;
    loan_term_years?: number;
    financable?: boolean;
  };
};

export async function fetchFinancingStructure(
  planId: string
): Promise<FinancingStructureProjection> {
  const res = await api<{ projection: FinancingStructureProjection }>(
    `/plans/${planId}/financing-structure`
  );
  return res.projection;
}

export async function listFinancingSources(planId: string): Promise<FinancingSource[]> {
  return api<FinancingSource[]>(`/plans/${planId}/financing-sources`);
}

export async function updateFinancingSource(
  planId: string,
  sourceId: string,
  body: Partial<
    Pick<FinancingSource, "label" | "amount" | "rate" | "term_years" | "grace_months">
  >
): Promise<FinancingSource> {
  return api<FinancingSource>(`/plans/${planId}/financing-sources/${sourceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function syncFinancingStructure(
  planId: string
): Promise<{ message: string; projection: FinancingStructureProjection }> {
  return api(`/plans/${planId}/financing-structure/sync-liasse`, { method: "POST" });
}
