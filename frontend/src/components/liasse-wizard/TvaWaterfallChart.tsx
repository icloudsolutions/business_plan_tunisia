"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartLtr from "@/components/ui/ChartLtr";
import { useFormat } from "@/hooks/useFormat";
import type { TvaProjection } from "@/lib/tva-api";

type Props = {
  projection: TvaProjection | null;
};

export default function TvaWaterfallChart({ projection }: Props) {
  const { formatCurrency } = useFormat();

  if (!projection?.by_year?.length) {
    return (
      <p className="rounded-lg border border-dashed border-navy-200 px-4 py-8 text-center text-sm text-navy-500">
        Renseignez produits et coûts pour afficher le flux TVA.
      </p>
    );
  }

  const data = projection.by_year.map((y) => ({
    year: `Y${y.year}`,
    collectee: y.tva_collectee,
    deductible: -y.tva_deductible,
    solde: y.solde_tva,
  }));

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-navy-800">Flux TVA Y1–Y7</h4>
      <div className="h-56">
        <ChartLtr className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={72} />
            <Tooltip formatter={(v: number) => formatCurrency(Math.abs(v))} />
            <ReferenceLine y={0} stroke="#64748b" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="collectee" name="TVA collectée" fill="#166534" radius={[4, 4, 0, 0]} />
            <Bar dataKey="deductible" name="TVA déductible" fill="#b91c1c" radius={[4, 4, 0, 0]} />
            <Bar dataKey="solde" name="Solde net" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </ChartLtr>
      </div>
    </div>
  );
}
