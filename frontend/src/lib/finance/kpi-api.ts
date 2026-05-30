import { api } from "@/lib/api";

export type PrimaryKpis = {
  van: number;
  tri: number | null;
  drci_years: number | null;
  drci_label: string;
  profitability_index: number | null;
  trc: number | null;
  discount_rate: number;
  total_investment: number;
};

export type AnnualPerformanceYear = {
  year: number;
  revenue: number;
  ebit: number;
  net_profit: number;
  gross_margin_pct: number;
  net_margin_pct: number;
  ebe: number;
};

export type KpiDashboardProjection = {
  scenario: string;
  primary: PrimaryKpis;
  annual_performance: AnnualPerformanceYear[];
  capacity: {
    capacity_utilization_pct: number[];
    break_even_revenue: number;
    y1_revenue: number;
    distance_above_break_even_pct: number;
    break_even_callout: string;
  };
  financing: {
    year: number;
    debt_ratio: number;
    dscr: number | null;
    remaining_debt: number;
    ebitda: number;
    debt_service: number;
  }[];
  financability: {
    is_financable: boolean;
    label: string;
    checks: Record<string, boolean>;
  };
  tri_status: "green" | "orange" | "red" | "neutral";
  chart_revenue_profit: { year: string; revenue: number; ebit: number; netProfit: number }[];
  chart_margins: { year: string; grossMarginPct: number; netMarginPct: number }[];
  chart_capacity: { year: string; utilization: number }[];
  chart_debt_coverage: {
    year: string;
    ebitda: number;
    debtService: number;
    dscr: number | null;
  }[];
};

export async function fetchKpiDashboard(
  planId: string,
  scenario: "base" | "pessimistic" | "optimistic" = "base"
): Promise<KpiDashboardProjection> {
  const res = await api<{ scenario: string; projection: KpiDashboardProjection }>(
    `/plans/${planId}/kpis?scenario=${scenario}`
  );
  return res.projection;
}
