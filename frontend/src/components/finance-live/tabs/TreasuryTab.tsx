"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import BfrAreaChart from "@/components/finance-live/BfrAreaChart";
import TreasuryWaterfallChart from "@/components/finance-live/TreasuryWaterfallChart";
import { useFormat } from "@/hooks/useFormat";
import {
  fetchCashFlow,
  type CashFlowProjection,
  type CashFlowYearRow,
} from "@/lib/finance/cash-flow-api";

type Props = {
  planId: string;
  scenario?: "base" | "pessimistic" | "optimistic";
};

const BFR_PRESETS = [
  { days: 20, label: "20 j" },
  { days: 33, label: "33 j (Excel)" },
  { days: 45, label: "45 j" },
] as const;

type RowKey =
  | "operating_cf"
  | "bfr_variation"
  | "initial_investment"
  | "financing"
  | "net_cash_flow"
  | "cumulative_treasury";

const TABLE_ROWS: { key: RowKey; label: string; compute?: (r: CashFlowYearRow) => number }[] = [
  { key: "operating_cf", label: "CF d'exploitation" },
  {
    key: "bfr_variation",
    label: "Variation BFR",
    compute: (r) => r.bfr_variation + r.bfr_recovery,
  },
  {
    key: "initial_investment",
    label: "Investissement",
    compute: (r) => r.initial_investment + r.net_book_value_recovery,
  },
  {
    key: "financing",
    label: "Dettes & fonds propres",
    compute: (r) => r.equity_inflow + r.debt_drawdown + r.principal_repayment,
  },
  { key: "net_cash_flow", label: "Trésorerie nette" },
  { key: "cumulative_treasury", label: "Trésorerie cumulée" },
];

function cellClass(v: number, isCumulative = false): string {
  const base = "px-2 py-1.5 text-end tabular-nums text-xs";
  if (isCumulative) {
    return `${base} font-semibold ${v >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`;
  }
  if (v > 0) return `${base} bg-emerald-50/80 text-emerald-800`;
  if (v < 0) return `${base} bg-red-50/80 text-red-800`;
  return `${base} text-slate-600`;
}

export default function TreasuryTab({ planId, scenario = "base" }: Props) {
  const { formatCurrency } = useFormat();
  const [projection, setProjection] = useState<CashFlowProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bfrDays, setBfrDays] = useState(33);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCashFlow(planId, {
        scenario,
        bfrClientDays: bfrDays,
      });
      setProjection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement trésorerie");
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [planId, scenario, bfrDays]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !projection) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Calcul du tableau de flux…
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }

  const rows = projection?.rows ?? [];
  const breakEven = projection?.treasury_break_even_year ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Tableau de flux de trésorerie annuel
            </h3>
            <p className="text-xs text-slate-500">
              Y0 à Y7 · moteur bp_calc · délai clients {bfrDays} j
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <label className="text-xs font-medium text-slate-600">
              Sensibilité BFR (jours de CA TTC)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={45}
                step={1}
                value={bfrDays}
                onChange={(e) => setBfrDays(Number(e.target.value))}
                className="h-2 w-40 accent-brand-600"
              />
              <span className="w-8 text-sm font-semibold tabular-nums text-slate-800">
                {bfrDays}
              </span>
            </div>
            <div className="flex gap-1">
              {BFR_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setBfrDays(p.days)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    bfrDays === p.days
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-2 py-2 text-start text-xs font-semibold text-slate-700">
                  Poste
                </th>
                {rows.map((r) => (
                  <th
                    key={r.year}
                    className="px-2 py-2 text-end text-xs font-semibold text-slate-700"
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map((def) => (
                <tr key={def.key} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-xs font-medium text-slate-700">
                    {def.label}
                  </td>
                  {rows.map((r) => {
                    const v =
                      def.compute?.(r) ??
                      (r[def.key as keyof CashFlowYearRow] as number);
                    const isCum = def.key === "cumulative_treasury";
                    return (
                      <td key={`${def.key}-${r.year}`} className={cellClass(v, isCum)}>
                        {formatCurrency(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TreasuryWaterfallChart
          projection={projection}
          breakEvenYear={breakEven}
        />
        <BfrAreaChart projection={projection} />
      </div>

      {loading && (
        <p className="text-center text-xs text-slate-400">Recalcul en cours…</p>
      )}
    </div>
  );
}
