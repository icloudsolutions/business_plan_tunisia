"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat } from "@/hooks/useFormat";
import type { CombinedLoanProjection } from "@/lib/loans-api";

type Props = {
  projection: CombinedLoanProjection | null;
};

export default function LoanDualAxisChart({ projection }: Props) {
  const { formatCurrency } = useFormat();

  if (!projection?.annual_ending_balance?.length) {
    return null;
  }

  const data = projection.annual_ending_balance.map((bal, i) => ({
    year: `Y${i + 1}`,
    encours: bal,
    interets: projection.annual_interest[i] ?? 0,
  }));

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-navy-800">
        Encours &amp; intérêts (toutes tranches)
      </h4>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10 }}
              width={72}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              width={56}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="encours"
              name="Capital restant dû"
              stroke="#1e3a5f"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="interets"
              name="Intérêts annuels"
              stroke="#b45309"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
