"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { DONUT_COLORS } from "@/lib/cost-api";
import type { ProductUnitCost } from "@/lib/cost-api";
import { useFormat } from "@/hooks/useFormat";

const LABELS: Record<string, string> = {
  mp: "MP",
  arome: "Arômes",
  packaging: "Emballage",
  utilities: "Énergie",
  labor: "MO",
  depreciation: "Amort.",
  waste: "Déchets",
};

type Props = {
  result: ProductUnitCost;
  compact?: boolean;
};

export default function CostDonutChart({ result, compact }: Props) {
  const { formatCurrency } = useFormat();
  const data = Object.entries(result.breakdown_pct)
    .filter(([, v]) => v > 0.5)
    .map(([key, value]) => ({
      name: LABELS[key] ?? key,
      value,
      fill: DONUT_COLORS[key] ?? "#94a3b8",
    }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-navy-500">Saisissez les coûts pour afficher le graphique.</p>
    );
  }

  return (
    <div className={compact ? "h-40 w-full" : "h-52 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={compact ? 28 : 40}
            outerRadius={compact ? 48 : 64}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => `${value.toFixed(1)} %`}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-navy-600">
        Coût unitaire : {formatCurrency(result.unit_cost)}
      </p>
    </div>
  );
}
