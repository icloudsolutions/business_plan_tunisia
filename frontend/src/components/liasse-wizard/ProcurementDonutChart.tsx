"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartLtr from "@/components/ui/ChartLtr";
import { useFormat } from "@/hooks/useFormat";

const COLORS: Record<string, string> = {
  mp: "#1e3a5f",
  arome: "#d97706",
  packaging: "#059669",
  other: "#64748b",
};

type Props = {
  data: { name: string; category: string; value: number; pct: number }[];
};

export default function ProcurementDonutChart({ data }: Props) {
  const { formatCurrency } = useFormat();
  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <h4 className="mb-2 text-sm font-semibold text-navy-800">Composition des achats (Y1–Y7)</h4>
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
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.category} fill={COLORS[d.category] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
          </PieChart>
        </ResponsiveContainer>
        </ChartLtr>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs text-navy-600">
        {data.map((d) => (
          <li key={d.category}>
            <span
              className="me-1 inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[d.category] }}
            />
            {d.name} ({d.pct}%)
          </li>
        ))}
      </ul>
    </div>
  );
}
