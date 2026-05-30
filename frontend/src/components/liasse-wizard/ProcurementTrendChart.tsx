"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartLtr from "@/components/ui/ChartLtr";
import { useFormat } from "@/hooks/useFormat";

type Props = {
  data: { year: string; mp: number; arome: number; packaging: number; other: number }[];
};

export default function ProcurementTrendChart({ data }: Props) {
  const { formatCurrency } = useFormat();
  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4">
      <h4 className="mb-2 text-sm font-semibold text-navy-800">Évolution des achats HT</h4>
      <div className="h-52">
        <ChartLtr className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={72} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="mp" stackId="1" name="MP" fill="#1e3a5f" />
            <Area type="monotone" dataKey="arome" stackId="1" name="Arômes" fill="#d97706" />
            <Area type="monotone" dataKey="packaging" stackId="1" name="Emballage" fill="#059669" />
            <Area type="monotone" dataKey="other" stackId="1" name="Autres" fill="#94a3b8" />
          </AreaChart>
        </ResponsiveContainer>
        </ChartLtr>
      </div>
    </div>
  );
}
