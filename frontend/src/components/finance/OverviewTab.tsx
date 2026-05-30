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
import { useFinance } from "@/context/FinanceContext";
import { formatTnd, monthlyProductionCost } from "@/lib/finance/calculations";
import SummaryCards from "./SummaryCards";
import { Card, CardHeader } from "./ui";

export default function OverviewTab() {
  const { products, summary } = useFinance();

  const productionChart = products.map((p) => ({
    name: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name,
    mensuel: monthlyProductionCost(p),
  }));

  const costSplit = [
    { label: "Production", value: summary.totalProductionCostMonthly },
    { label: "Masse salariale", value: summary.totalPayrollEmployer },
  ];

  return (
    <div className="space-y-8">
      <SummaryCards />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Coût de production par produit"
            subtitle="Estimation mensuelle (mock)"
          />
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatTnd(v)} />
                <Legend />
                <Bar dataKey="mensuel" name="Coût mensuel" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Structure des charges"
            subtitle="Production vs masse salariale"
          />
          <div className="space-y-4">
            {costSplit.map((item) => {
              const total =
                summary.totalProductionCostMonthly + summary.totalPayrollEmployer;
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="tabular-nums text-slate-600">
                      {formatTnd(item.value)} ({pct.toFixed(0)} %)
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.label === "Production"
                          ? "bg-blue-500"
                          : "bg-violet-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
