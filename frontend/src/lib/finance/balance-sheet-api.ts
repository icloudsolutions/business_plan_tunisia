import { api } from "@/lib/api";

export type BalanceLineItem = {
  key: string;
  label: string;
  amount: number;
  children: BalanceLineItem[];
};

export type BalanceSheetSide = {
  title: string;
  total: number;
  sections: BalanceLineItem[];
};

export type BalanceSheetRatios = {
  endettement: number | null;
  liquidite: number | null;
  fonds_roulement: number;
  bfr: number;
  tresorerie_nette: number;
};

export type BalanceSheetYear = {
  year: number;
  assets: BalanceSheetSide;
  liabilities: BalanceSheetSide;
  total_assets: number;
  total_liabilities_equity: number;
  balanced: boolean;
  gap: number;
  ratios: BalanceSheetRatios;
};

export type BalanceSheetProjection = {
  years: BalanceSheetYear[];
  composition_series: {
    net_fixed_assets: number[];
    current_assets: number[];
  };
  engine_balance_check?: boolean;
};

export async function fetchBalanceSheet(
  planId: string,
  scenario: "base" | "pessimistic" | "optimistic" = "base"
): Promise<BalanceSheetProjection> {
  const res = await api<{ scenario: string; projection: BalanceSheetProjection }>(
    `/plans/${planId}/balance-sheet?scenario=${scenario}`
  );
  return res.projection;
}
