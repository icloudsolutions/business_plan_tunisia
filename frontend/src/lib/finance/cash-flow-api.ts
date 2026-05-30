import { api } from "@/lib/api";

export type CashFlowYearRow = {
  year: number;
  label: string;
  operating_cf: number;
  equity_inflow: number;
  debt_drawdown: number;
  initial_investment: number;
  bfr_variation: number;
  principal_repayment: number;
  bfr_recovery: number;
  net_book_value_recovery: number;
  net_cash_flow: number;
  cumulative_treasury: number;
};

export type BfrComponents = {
  year: number;
  client_receivables: number;
  stocks: number;
  supplier_payables: number;
  total_bfr: number;
  bfr_variation: number;
};

export type CashFlowProjection = {
  rows: CashFlowYearRow[];
  bfr_series: BfrComponents[];
  treasury_break_even_year: number | null;
  chart_waterfall: {
    period: string;
    net: number;
    cumulative: number;
    operating: number;
    bfr_var: number;
    investment: number;
  }[];
  composition_bfr: {
    receivables: number[];
    stocks: number[];
    payables: number[];
    total_bfr: number[];
  };
  bfr_client_days: number;
};

export async function fetchCashFlow(
  planId: string,
  opts?: {
    scenario?: "base" | "pessimistic" | "optimistic";
    bfrClientDays?: number;
    useCompactBfr?: boolean;
  }
): Promise<CashFlowProjection> {
  const q = new URLSearchParams();
  q.set("scenario", opts?.scenario ?? "base");
  if (opts?.bfrClientDays != null) q.set("bfr_client_days", String(opts.bfrClientDays));
  if (opts?.useCompactBfr) q.set("use_compact_bfr", "true");
  const res = await api<{ projection: CashFlowProjection; bfr_client_days: number }>(
    `/plans/${planId}/cash-flow?${q}`
  );
  return { ...res.projection, bfr_client_days: res.bfr_client_days };
}
