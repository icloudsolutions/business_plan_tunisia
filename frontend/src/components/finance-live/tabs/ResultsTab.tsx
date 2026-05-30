"use client";

import ChartLtr from "@/components/ui/ChartLtr";
import ChartSuspense from "@/components/ui/ChartSuspense";
import { formatTnd, type ProjectionPayload } from "@/lib/finance/projections-api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/lib/recharts-dynamic";

type Props = {
  base: ProjectionPayload;
  overlay?: ProjectionPayload | null;
  overlayLabel?: string;
};

export default function ResultsTab({ base, overlay, overlayLabel }: Props) {
  const chartData = base.pl.map((row, i) => {
    const ov = overlay?.pl[i];
    return {
      year: `An ${row.year}`,
      revenue: row.revenue,
      expenses: row.totalExpenses,
      netProfit: row.netProfit,
      overlayRevenue: ov?.revenue,
      overlayNet: ov?.netProfit,
    };
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Compte de résultat — 7 ans</h3>
      <p className="mb-4 text-xs text-slate-500">
        CA HT, charges totales et résultat net
        {overlayLabel ? ` · overlay : ${overlayLabel}` : ""}
      </p>
      <ChartSuspense>
        <div className="h-80">
          <ChartLtr className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatTnd(v, true)} />
                <Tooltip formatter={(value: number | string) => formatTnd(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" name="CA HT" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Charges" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netProfit" name="Résultat net" fill="#059669" radius={[4, 4, 0, 0]} />
                {overlay && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="overlayRevenue"
                      name={`CA (${overlayLabel})`}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="overlayNet"
                      name={`RN (${overlayLabel})`}
                      stroke="#dc2626"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartLtr>
        </div>
      </ChartSuspense>
    </div>
  );
}
