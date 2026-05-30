"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatTnd, type ProjectionPayload } from "@/lib/finance/projections-api";

const PIE_COLORS = ["#2563eb", "#7c3aed", "#059669", "#f59e0b", "#dc2626", "#64748b"];

export default function InvestmentsTab({ data }: { data: ProjectionPayload }) {
  const pie = data.investments;
  const total = pie.reduce((s, p) => s + p.value, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">CAPEX par catégorie</h3>
        <p className="mb-2 text-xs text-slate-500">
          Total : <strong>{formatTnd(total)} TND</strong>
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {pie.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatTnd(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Détail des immobilisations</h3>
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
          {data.investmentDetails.map((row) => (
            <li
              key={row.name}
              className="flex justify-between gap-2 border-b border-slate-50 py-2"
            >
              <span className="text-slate-700">{row.name}</span>
              <span className="shrink-0 tabular-nums font-medium text-slate-900">
                {formatTnd(row.value)} TND
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
