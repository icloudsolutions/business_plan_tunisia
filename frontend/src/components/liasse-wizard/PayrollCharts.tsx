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
import ChartLtr from "@/components/ui/ChartLtr";
import { useFormat } from "@/hooks/useFormat";
import type { PayrollProjection } from "@/lib/payroll-api";

type Props = {
  projection: PayrollProjection | null;
};

const YEAR_LABELS = ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"];

export default function PayrollCharts({ projection }: Props) {
  const { formatCurrency } = useFormat();

  if (!projection?.by_year?.length) {
    return (
      <p className="rounded-lg border border-dashed border-navy-200 px-4 py-8 text-center text-sm text-navy-500">
        Ajoutez des postes pour afficher les graphiques de masse salariale.
      </p>
    );
  }

  const headcountData = projection.headcount_series.map((v, i) => ({
    year: YEAR_LABELS[i] ?? `Y${i + 1}`,
    effectifs: v,
  }));

  const payrollData = projection.by_year.map((y) => ({
    year: `Y${y.year}`,
    masse: y.total_payroll,
    cnss: y.cnss,
  }));

  const splitData = projection.by_year.map((y) => ({
    year: `Y${y.year}`,
    imputable: y.imputable_cost,
    nonImputable: y.non_imputable_cost,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-navy-100 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">Effectifs totaux</h4>
        <div className="h-52">
        <ChartLtr className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={headcountData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="effectifs" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartLtr>
        </div>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">Masse salariale &amp; CNSS</h4>
        <div className="h-52">
        <ChartLtr className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payrollData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={72} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="masse" name="Total" fill="#b8860b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cnss" name="CNSS" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartLtr>
        </div>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4 lg:col-span-2">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">
          Répartition imputable production / autres charges
        </h4>
        <div className="h-52">
        <ChartLtr className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={splitData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={72} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="imputable"
                name="Imputable production"
                stackId="a"
                fill="#166534"
              />
              <Bar
                dataKey="nonImputable"
                name="Non imputable"
                stackId="a"
                fill="#94a3b8"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartLtr>
        </div>
      </div>
    </div>
  );
}
