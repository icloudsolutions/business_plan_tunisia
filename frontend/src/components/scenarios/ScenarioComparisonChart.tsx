"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SCENARIO_COLORS } from "@/lib/scenarios-api";

type Props = {
  series: Record<string, number[]>;
  labels: Record<string, string>;
};

export default function ScenarioComparisonChart({ series, labels }: Props) {
  const slugs = Object.keys(series).filter((k) => series[k]?.length);
  if (!slugs.length) {
    return <p className="text-sm text-navy-500">Aucune projection calculée.</p>;
  }

  const years = Math.max(...slugs.map((s) => series[s].length), 0);
  const data = Array.from({ length: years }, (_, i) => {
    const row: Record<string, number | string> = { year: `An ${i + 1}` };
    for (const slug of slugs) {
      row[slug] = series[slug][i] ?? 0;
    }
    return row;
  });

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => `${v.toLocaleString("fr-TN")} TND`} />
          <Legend />
          {slugs.map((slug) => (
            <Line
              key={slug}
              type="monotone"
              dataKey={slug}
              name={labels[slug] ?? slug}
              stroke={SCENARIO_COLORS[slug] ?? "#3b82f6"}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
