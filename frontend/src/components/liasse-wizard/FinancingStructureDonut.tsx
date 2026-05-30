"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartLtr from "@/components/ui/ChartLtr";
import { useFormat } from "@/hooks/useFormat";
import type { FinancingStructureProjection } from "@/lib/financing-structure-api";

const SLICE_COLORS: Record<string, string> = {
  equity: "#059669",
  debt: "#1e3a5f",
  other: "#d97706",
};

type Props = {
  projection: FinancingStructureProjection | null;
};

export default function FinancingStructureDonut({ projection }: Props) {
  const { formatCurrency, formatPercent } = useFormat();
  const data = projection?.chart_structure ?? [];
  const summary = projection?.summary;
  const minPct = (summary?.min_equity_ratio_required ?? 0.25) * 100;

  if (!data.length && !summary) return null;

  const conforme = summary?.structure_status === "conforme";

  return (
    <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-navy-800">Structure fonds propres / dette</h4>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            conforme ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {summary?.structure_label ?? "—"}
        </span>
      </div>
      <div className="h-52">
        <ChartLtr className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              label={({ name, pct }) => `${name} ${pct}%`}
              labelLine={false}
            >
              {data.map((d) => (
                <Cell key={d.slice} fill={SLICE_COLORS[d.slice] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
        </ChartLtr>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-navy-600">
        {data.map((d) => (
          <li key={d.slice}>
            <span
              className="me-1 inline-block h-2 w-2 rounded-full"
              style={{ background: SLICE_COLORS[d.slice] }}
            />
            {d.name} — {formatCurrency(d.value)} ({d.pct}%)
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/50 px-3 py-2 text-xs text-navy-700">
        <p>
          Standard bancaire : fonds propres ≥ {minPct}% du financement total.
        </p>
        <p className="mt-1">
          Ratio actuel :{" "}
          <strong>{formatPercent(summary?.equity_ratio ?? 0)}</strong> fonds propres /{" "}
          <strong>{formatPercent(summary?.debt_ratio ?? 0)}</strong> dette
          {summary?.meets_bank_equity_minimum ? (
            <span className="ms-1 text-green-700">✓ seuil atteint</span>
          ) : (
            <span className="ms-1 text-red-700">✗ sous le seuil</span>
          )}
        </p>
      </div>
    </section>
  );
}
