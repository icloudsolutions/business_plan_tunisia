"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useFinance } from "@/context/FinanceContext";
import { formatPct, formatTnd } from "@/lib/finance/calculations";
import { Card, CardHeader } from "./ui";

export default function SalaryDistributionTab() {
  const { summary, salaryPieData, payrollLines } = useFinance();
  const total = summary.directPayroll + summary.indirectPayroll;
  const directPct = total > 0 ? (summary.directPayroll / total) * 100 : 0;
  const indirectPct = total > 0 ? (summary.indirectPayroll / total) * 100 : 0;

  const directLines = payrollLines.filter((l) => l.laborType === "direct");
  const indirectLines = payrollLines.filter((l) => l.laborType === "indirect");

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Répartition analytique des salaires"
            subtitle="Main-d'œuvre directe vs indirecte (% du coût employeur)"
          />
          <div className="h-72 w-full sm:h-80">
            {salaryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salaryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
                    }
                    labelLine={false}
                  >
                    {salaryPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatTnd(value)}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-20 text-center text-slate-500">
                Aucune donnée salariale
              </p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-xs font-medium uppercase text-blue-600">
                Direct
              </p>
              <p className="mt-1 text-xl font-bold text-blue-900">
                {formatPct(directPct)}
              </p>
              <p className="text-sm text-blue-700">
                {formatTnd(summary.directPayroll)}
              </p>
            </div>
            <div className="rounded-lg bg-violet-50 p-4">
              <p className="text-xs font-medium uppercase text-violet-600">
                Indirect
              </p>
              <p className="mt-1 text-xl font-bold text-violet-900">
                {formatPct(indirectPct)}
              </p>
              <p className="text-sm text-violet-700">
                {formatTnd(summary.indirectPayroll)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Ventilation par poste"
            subtitle="Coût employeur mensuel par catégorie"
          />
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-800">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Main-d&apos;œuvre directe (production)
              </h3>
              <ul className="space-y-2">
                {directLines.map((l) => (
                  <li
                    key={l.id}
                    className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {l.poste}{" "}
                      <span className="text-slate-400">× {l.headcount}</span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatTnd(l.totalEmployerCost)}
                    </span>
                  </li>
                ))}
                {directLines.length === 0 && (
                  <li className="text-sm text-slate-400">—</li>
                )}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                Main-d&apos;œuvre indirecte (support, admin, direction)
              </h3>
              <ul className="space-y-2">
                {indirectLines.map((l) => (
                  <li
                    key={l.id}
                    className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {l.poste}{" "}
                      <span className="text-slate-400">× {l.headcount}</span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatTnd(l.totalEmployerCost)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Card>
      </div>

      <Card className="border-dashed border-brand-200 bg-brand-50/30">
        <p className="text-sm text-slate-600">
          <strong className="text-brand-800">Analyse :</strong> une part de MO
          directe élevée ({formatPct(directPct)}) est typique d&apos;une activité
          manufacturière intensive. Les coûts indirects couvrent l&apos;encadrement,
          la qualité et l&apos;administration — à intégrer dans le prix de revient
          via clés de répartition.
        </p>
      </Card>
    </div>
  );
}
