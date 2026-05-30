"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat } from "@/hooks/useFormat";
import type { BalanceSheetProjection } from "@/lib/finance/balance-sheet-api";

type Props = {
  projection: BalanceSheetProjection | null;
};

export default function BalanceCompositionChart({ projection }: Props) {
  const { formatCurrency } = useFormat();

  if (!projection?.composition_series?.net_fixed_assets?.length) return null;

  const data = projection.composition_series.net_fixed_assets.map((fixed, i) => ({
    year: `Y${i + 1}`,
    immobilisations: fixed,
    actifsCourants: projection.composition_series.current_assets[i] ?? 0,
  }));

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-navy-800">
        Composition des actifs Y1–Y7
      </h4>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={72} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="immobilisations"
              name="Immobilisations nettes"
              stackId="a"
              fill="#1e3a5f"
            />
            <Bar
              dataKey="actifsCourants"
              name="Actifs courants"
              stackId="a"
              fill="#b8860b"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
