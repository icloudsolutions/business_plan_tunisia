"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTnd, type ProjectionPayload } from "@/lib/finance/projections-api";

const COLORS: Record<string, string> = {
  inflow: "#059669",
  outflow: "#dc2626",
  total: "#2563eb",
};

export default function TreasuryTab({ data }: { data: ProjectionPayload }) {
  const annual = data.pl.map((r) => ({
    year: `An ${r.year}`,
    ocf: r.operatingCashFlow,
    treasury: r.cumulativeTreasury,
    principal: -(r.principalRepayment ?? 0),
  }));

  const waterfall = data.treasuryWaterfall.map((s) => ({
    step: s.step.length > 22 ? `${s.step.slice(0, 20)}…` : s.step,
    value: s.value,
    fill: COLORS[s.type] ?? "#64748b",
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Trésorerie annuelle</h3>
        <p className="mb-4 text-xs text-slate-500">CF exploitation et cumul (TND)</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={annual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatTnd(v, true)} />
              <Tooltip formatter={(v: number) => formatTnd(v)} />
              <Bar dataKey="ocf" name="CF exploitation" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="treasury" name="Trésorerie cumulée" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Waterfall trésorerie</h3>
        <p className="mb-4 text-xs text-slate-500">Flux projetés sur la durée du plan</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfall} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(v) => formatTnd(v, true)} />
              <YAxis type="category" dataKey="step" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatTnd(v)} />
              <Bar dataKey="value" name="Montant">
                {waterfall.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
