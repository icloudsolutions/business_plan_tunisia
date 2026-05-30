"use client";

import { useFormat } from "@/hooks/useFormat";
import {
  marginRowClass,
  type PricingProjection,
  type PricingRowComputed,
} from "@/lib/pricing-api";

type Props = {
  projection: PricingProjection | null;
  readOnly?: boolean;
  saving?: boolean;
  onUpdate: (
    rowId: string,
    patch: Partial<{
      purchase_price_per_kg: number;
      sell_price_per_unit: number;
      market_retail_price: number;
      ristourne_pct: number;
    }>
  ) => void;
};

export default function PricingGridTable({ projection, readOnly, saving, onUpdate }: Props) {
  const { formatCurrency, formatPercent } = useFormat();
  const rows = projection?.rows ?? [];
  const gridByProduct = new Map(
    (projection?.grid ?? []).map((g) => [g.product_id, g.id])
  );

  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-navy-200 py-8 text-center text-sm text-navy-500">
        Ajoutez des produits à l&apos;étape « Produits &amp; Prix » pour construire la grille.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-navy-100 bg-navy-50 text-xs text-navy-700">
            <th className="px-2 py-2 text-start">Produit</th>
            <th className="px-2 py-2 text-end">Prix achat/kg</th>
            <th className="px-2 py-2 text-end">Prix vente/unité</th>
            <th className="px-2 py-2 text-end">Prix vente/kg</th>
            <th className="px-2 py-2 text-end">Prix marché</th>
            <th className="px-2 py-2 text-end">Ristourne %</th>
            <th className="px-2 py-2 text-end">Marge brute</th>
            <th className="px-2 py-2 text-end">Marge %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <PricingRow
              key={row.product_id}
              row={row}
              gridId={gridByProduct.get(row.product_id)}
              readOnly={readOnly}
              saving={saving}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              onUpdate={onUpdate}
            />
          ))}
        </tbody>
      </table>
      <p className="border-t border-navy-100 px-3 py-2 text-xs text-navy-500">
        Couleurs : &lt; 10 % marge (rouge), 10–25 % (orange), &gt; 25 % (vert).
      </p>
    </div>
  );
}

function PricingRow({
  row,
  gridId,
  readOnly,
  saving,
  formatCurrency,
  formatPercent,
  onUpdate,
}: {
  row: PricingRowComputed;
  gridId?: string;
  readOnly?: boolean;
  saving?: boolean;
  formatCurrency: (n: number) => string;
  formatPercent: (n: number) => string;
  onUpdate: Props["onUpdate"];
}) {
  const band = marginRowClass(row.margin_band);

  const save = (patch: Parameters<Props["onUpdate"]>[1]) => {
    if (gridId) onUpdate(gridId, patch);
  };

  return (
    <tr className={`border-b border-navy-50 ${band}`}>
      <td className="px-2 py-2 font-medium text-navy-800">
        {row.product_name}
        <span className="ms-1 text-xs font-normal text-navy-500">({row.unit})</span>
        <CompetitivenessHint row={row} />
      </td>
      <td className="px-2 py-2 text-end">
        <NumInput
          disabled={readOnly || saving || !gridId}
          value={row.purchase_price_per_kg}
          onCommit={(v) => save({ purchase_price_per_kg: v })}
        />
      </td>
      <td className="px-2 py-2 text-end">
        <NumInput
          disabled={readOnly || saving || !gridId}
          value={row.sell_price_per_unit}
          onCommit={(v) => save({ sell_price_per_unit: v })}
        />
      </td>
      <td className="px-2 py-2 text-end tabular-nums text-navy-700">
        {formatCurrency(row.sell_price_per_kg)}
      </td>
      <td className="px-2 py-2 text-end">
        <NumInput
          disabled={readOnly || saving || !gridId}
          value={row.market_retail_price}
          onCommit={(v) => save({ market_retail_price: v })}
        />
      </td>
      <td className="px-2 py-2 text-end">
        <NumInput
          disabled={readOnly || saving || !gridId}
          value={Math.round(row.ristourne_pct * 1000) / 10}
          step={0.5}
          max={100}
          onCommit={(v) => save({ ristourne_pct: v / 100 })}
        />
        <span className="text-xs text-navy-500"> %</span>
      </td>
      <td className="px-2 py-2 text-end tabular-nums">{formatCurrency(row.gross_margin_unit)}</td>
      <td className="px-2 py-2 text-end tabular-nums font-medium">
        {row.gross_margin_pct != null ? formatPercent(row.gross_margin_pct) : "—"}
      </td>
    </tr>
  );
}

function CompetitivenessHint({ row }: { row: PricingRowComputed }) {
  if (!row.market_retail_price || row.market_retail_price <= 0) return null;
  const pct = row.below_market_pct;
  if (pct == null) return null;
  const ok = pct > 0;
  return (
    <p className={`mt-0.5 text-[11px] ${ok ? "text-green-700" : "text-red-600"}`}>
      {ok
        ? `Votre prix est ${pct}% en dessous du marché`
        : `Votre prix est ${Math.abs(pct)}% au-dessus du marché`}
    </p>
  );
}

function NumInput({
  value,
  disabled,
  step = 0.01,
  max,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  step?: number;
  max?: number;
  onCommit: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      step={step}
      disabled={disabled}
      className="w-24 rounded border border-navy-200 px-2 py-1 text-end text-sm tabular-nums"
      defaultValue={value}
      onBlur={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v) && v !== value) onCommit(v);
      }}
    />
  );
}
