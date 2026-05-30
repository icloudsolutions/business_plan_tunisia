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
import { useFormat } from "@/hooks/useFormat";
import type { PricingChartBar } from "@/lib/pricing-api";

const COLORS = {
  cost: "#1e3a5f",
  producer_margin: "#059669",
  reseller_margin: "#d97706",
};

type Props = {
  bars: PricingChartBar[];
  selectedProductId?: string | null;
};

export default function PricingCompetitivenessChart({ bars, selectedProductId }: Props) {
  const { formatCurrency } = useFormat();
  const filtered = selectedProductId
    ? bars.filter((b) => b.product_id === selectedProductId)
    : bars.slice(0, 5);

  if (!filtered.length) return null;

  const data = filtered.map((b) => ({
    name: b.product_name || "Produit",
    Coût: b.cost,
    "Marge producteur": b.producer_margin,
    "Marge distributeur": b.reseller_margin,
    shelf: b.shelf_price,
  }));

  return (
    <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <h4 className="mb-2 text-sm font-semibold text-navy-800">
        Chaîne de prix (coût → vous → distributeur → rayon)
      </h4>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `${v}`} />
            <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Coût" stackId="a" fill={COLORS.cost} />
            <Bar dataKey="Marge producteur" stackId="a" fill={COLORS.producer_margin} />
            <Bar dataKey="Marge distributeur" stackId="a" fill={COLORS.reseller_margin} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-navy-500">
        Prix rayon (référence) :{" "}
        {filtered.map((b) => (
          <span key={b.product_id} className="me-2">
            {b.product_name} {formatCurrency(b.shelf_price)}
          </span>
        ))}
      </p>
    </section>
  );
}
