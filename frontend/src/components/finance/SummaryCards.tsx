"use client";

import { Factory, Package, TrendingUp, Users } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatTnd } from "@/lib/finance/calculations";

export default function SummaryCards() {
  const { summary, products } = useFinance();

  const cards = [
    {
      title: "Coût production mensuel",
      value: formatTnd(summary.totalProductionCostMonthly),
      hint: `${products.length} produit(s) fini(s)`,
      icon: Factory,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Masse salariale (coût employeur)",
      value: formatTnd(summary.totalPayrollEmployer),
      hint: `${summary.totalHeadcount} effectifs`,
      icon: Users,
      color: "from-violet-500 to-violet-600",
    },
    {
      title: "Coût de revient moyen",
      value: formatTnd(summary.avgUnitCost, 2),
      hint: "Par unité produite",
      icon: Package,
      color: "from-emerald-500 to-emerald-600",
    },
    {
      title: "Charges totales (prod. + RH)",
      value: formatTnd(
        summary.totalProductionCostMonthly + summary.totalPayrollEmployer
      ),
      hint: "Estimation mensuelle",
      icon: TrendingUp,
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.title}
          className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div
            className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${c.color} opacity-10 transition group-hover:opacity-20`}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{c.title}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {c.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
            </div>
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${c.color} text-white shadow-sm`}
            >
              <c.icon className="h-5 w-5" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
