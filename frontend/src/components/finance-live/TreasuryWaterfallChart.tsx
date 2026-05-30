"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat } from "@/hooks/useFormat";
import type { CashFlowProjection } from "@/lib/finance/cash-flow-api";

type Props = {
  projection: CashFlowProjection | null;
  breakEvenYear?: number | null;
};

export default function TreasuryWaterfallChart({ projection, breakEvenYear }: Props) {
  const { formatCurrency } = useFormat();

  if (!projection?.chart_waterfall?.length) return null;

  const data = projection.chart_waterfall.map((d) => ({
    period: d.period,
    net: d.net,
    cumulative: d.cumulative,
  }));

  const breakEvenLabel =
    breakEvenYear != null ? `Y${breakEvenYear}` : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Flux de trésorerie &amp; cumul</h3>
      <p className="mb-2 text-xs text-slate-500">
        Barres = flux net par période · Courbe = trésorerie cumulée
        {breakEvenYear != null && (
          <span className="ms-2 font-medium text-emerald-700">
            · Point d&apos;équilibre de trésorerie : Y{breakEvenYear}
          </span>
        )}
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 48, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={72} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={72} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <ReferenceLine yAxisId="left" y={0} stroke="#64748b" />
            {breakEvenLabel && (
              <ReferenceLine
                yAxisId="right"
                x={breakEvenLabel}
                stroke="#059669"
                strokeDasharray="4 4"
                label={{
                  value: "Équilibre",
                  position: "top",
                  fontSize: 10,
                  fill: "#059669",
                }}
              />
            )}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="net" name="Flux net" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={`net-${i}`}
                  fill={entry.net >= 0 ? "#059669" : "#dc2626"}
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative"
              name="Trésorerie cumulée"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
