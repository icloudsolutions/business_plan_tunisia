"use client";

import {
  Area,
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
import type { CashFlowProjection } from "@/lib/finance/cash-flow-api";

type Props = {
  projection: CashFlowProjection | null;
};

export default function BfrAreaChart({ projection }: Props) {
  const { formatCurrency } = useFormat();

  const comp = projection?.composition_bfr;
  if (!comp?.receivables?.length) return null;

  const n = comp.receivables.length;
  const data = Array.from({ length: n }, (_, i) => ({
    year: i === 0 ? "Y0" : `Y${i}`,
    receivables: comp.receivables[i] ?? 0,
    stocks: comp.stocks[i] ?? 0,
    payables: comp.payables[i] ?? 0,
    total: comp.total_bfr[i] ?? 0,
  })).filter((d) => d.year !== "Y0" || d.total !== 0);

  const chartData =
    data[0]?.year === "Y0" && data.length > 1 ? data.slice(1) : data.length ? data : [];

  if (!chartData.length) {
    const fromSeries = projection?.bfr_series ?? [];
    if (!fromSeries.length) return null;
    return (
      <BfrFromSeries series={fromSeries} formatCurrency={formatCurrency} />
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Évolution du BFR</h3>
      <p className="mb-2 text-xs text-slate-500">
        Créances clients + stocks − dettes fournisseurs (TND)
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={72} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="receivables"
              name="Créances clients"
              stackId="bfr"
              fill="#3b82f6"
              stroke="#2563eb"
              fillOpacity={0.75}
            />
            <Area
              type="monotone"
              dataKey="stocks"
              name="Stocks"
              stackId="bfr"
              fill="#f59e0b"
              stroke="#d97706"
              fillOpacity={0.75}
            />
            <Area
              type="monotone"
              dataKey="payables"
              name="Fournisseurs"
              stackId="bfr"
              fill="#ef4444"
              stroke="#dc2626"
              fillOpacity={0.6}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="BFR total"
              stroke="#0f172a"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BfrFromSeries({
  series,
  formatCurrency,
}: {
  series: NonNullable<CashFlowProjection["bfr_series"]>;
  formatCurrency: (n: number) => string;
}) {
  const chartData = series.map((b) => ({
    year: `Y${b.year}`,
    receivables: b.client_receivables,
    stocks: b.stocks,
    payables: -b.supplier_payables,
    total: b.total_bfr,
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Évolution du BFR</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={72} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="receivables"
              name="Créances"
              stackId="bfr"
              fill="#3b82f6"
              fillOpacity={0.75}
            />
            <Area
              type="monotone"
              dataKey="stocks"
              name="Stocks"
              stackId="bfr"
              fill="#f59e0b"
              fillOpacity={0.75}
            />
            <Area
              type="monotone"
              dataKey="payables"
              name="Fournisseurs (−)"
              stackId="bfr"
              fill="#ef4444"
              fillOpacity={0.6}
            />
            <Line type="monotone" dataKey="total" name="BFR total" stroke="#0f172a" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
