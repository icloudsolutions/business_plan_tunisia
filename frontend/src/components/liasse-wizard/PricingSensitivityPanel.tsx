"use client";

import { useMemo, useState } from "react";
import { useFormat } from "@/hooks/useFormat";
import type { PricingRowComputed } from "@/lib/pricing-api";

type Props = {
  rows: PricingRowComputed[];
};

export default function PricingSensitivityPanel({ rows }: Props) {
  const { formatCurrency, formatPercent } = useFormat();
  const [productId, setProductId] = useState<string>(rows[0]?.product_id ?? "");
  const [sellMultiplier, setSellMultiplier] = useState(100);

  const base = rows.find((r) => r.product_id === productId) ?? rows[0];

  const simulated = useMemo(() => {
    if (!base) return null;
    const factor = sellMultiplier / 100;
    const sell = base.sell_price_per_unit * factor;
    const kg = Math.max(base.unit_weight_g, 1) / 1000;
    const costUnit = base.purchase_price_per_kg * kg;
    const marginUnit = sell - costUnit;
    const marginPct = sell > 0 ? marginUnit / sell : null;
    const below =
      base.market_retail_price > 0
        ? Math.round((1 - sell / base.market_retail_price) * 1000) / 10
        : null;
    return { sell, marginUnit, marginPct, below };
  }, [base, sellMultiplier]);

  if (!rows.length || !base) return null;

  return (
    <section className="rounded-xl border border-gold-200 bg-gold-50/40 p-4">
      <h4 className="mb-3 text-sm font-semibold text-navy-800">Sensibilité prix de vente</h4>
      <div className="mb-3 flex flex-wrap gap-3">
        <label className="text-xs text-navy-700">
          Produit
          <select
            className="mt-1 block w-full min-w-[10rem] rounded-lg border border-navy-200 px-2 py-1.5 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {rows.map((r) => (
              <option key={r.product_id} value={r.product_id}>
                {r.product_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-xs font-medium text-navy-700">
        Prix vente/unité : {sellMultiplier}% du scénario ({formatCurrency(simulated?.sell ?? 0)})
      </label>
      <input
        type="range"
        min={70}
        max={130}
        step={1}
        value={sellMultiplier}
        onChange={(e) => setSellMultiplier(Number(e.target.value))}
        className="mt-2 w-full accent-gold-500"
      />
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-white px-3 py-2">
          <span className="text-xs text-navy-500">Marge brute simulée</span>
          <p className="font-semibold tabular-nums">{formatCurrency(simulated?.marginUnit ?? 0)}</p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2">
          <span className="text-xs text-navy-500">Marge %</span>
          <p className="font-semibold tabular-nums">
            {simulated?.marginPct != null ? formatPercent(simulated.marginPct) : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2">
          <span className="text-xs text-navy-500">vs. marché</span>
          <p
            className={`font-semibold ${
              (simulated?.below ?? 0) > 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {simulated?.below != null
              ? `${simulated.below > 0 ? "" : "+"}${Math.abs(simulated.below)}% ${
                  simulated.below > 0 ? "sous" : "au-dessus"
                } du marché`
              : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}
