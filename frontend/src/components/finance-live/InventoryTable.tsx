"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFormat } from "@/hooks/useFormat";
import type { InventoryProjection } from "@/lib/finance/projections-api";

type Props = {
  inventory: InventoryProjection;
};

const ROWS: {
  key: keyof InventoryProjection;
  label: string;
  stockMp?: boolean;
}[] = [
  { key: "qtySold", label: "Quantité vendue" },
  { key: "qtyProduced", label: "Quantité produite" },
  { key: "qtyConsumed", label: "Consommation MP" },
  { key: "qtyPurchased", label: "Achats MP" },
  { key: "closingStockMP", label: "Stock final MP", stockMp: true },
  { key: "closingStockPF", label: "Stock final PF" },
];

function stockMpBand(consumed: number, closing: number): "green" | "orange" | "neutral" {
  if (consumed <= 0) return "neutral";
  const oneMonth = consumed / 12;
  if (closing < (consumed / 24)) return "orange";
  if (closing > (consumed / 6)) return "orange";
  return "green";
}

export default function InventoryTable({ inventory }: Props) {
  const { formatNumber, formatCurrency } = useFormat();
  const [auditOpen, setAuditOpen] = useState(false);

  const years = useMemo(() => {
    const n = inventory.qtySold?.length ?? 0;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [inventory]);

  const y1Audit = useMemo(() => {
    const sold = inventory.qtySold[0] ?? 0;
    const closingPf = inventory.closingStockPF[0] ?? 0;
    const produced = inventory.qtyProduced[0] ?? 0;
    const consumed = inventory.qtyConsumed[0] ?? 0;
    const openingMp = inventory.openingStockMP[0] ?? 0;
    const purchased = inventory.qtyPurchased[0] ?? 0;
    const closingMp = inventory.closingStockMP[0] ?? 0;
    const purchaseVal = inventory.purchaseValueMP[0] ?? 0;
    return { sold, closingPf, produced, consumed, openingMp, purchased, closingMp, purchaseVal };
  }, [inventory]);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-600">
              <th className="px-3 py-2 text-start">Poste</th>
              {years.map((y) => (
                <th key={y} className="px-3 py-2 text-end">
                  Y{y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, stockMp }) => (
              <tr key={key} className="border-b border-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{label}</td>
                {(inventory[key] ?? []).map((val, yi) => {
                  let rowClass = "";
                  if (stockMp) {
                    const consumed = inventory.qtyConsumed[yi] ?? 0;
                    const band = stockMpBand(consumed, val);
                    if (band === "green") rowClass = "bg-green-50/80";
                    if (band === "orange") rowClass = "bg-amber-50/80";
                  }
                  return (
                    <td
                      key={yi}
                      className={`px-3 py-2 text-end tabular-nums ${rowClass}`}
                    >
                      {formatNumber(val, { maximumFractionDigits: 0 })}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
              <td className="px-3 py-2">Valeur achats MP (TND)</td>
              {inventory.purchaseValueMP.map((v, yi) => (
                <td key={yi} className="px-3 py-2 text-end tabular-nums">
                  {formatCurrency(v)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Stock MP : vert ≈ 1 mois de consommation ; orange si &lt; 15 j ou &gt; 2 mois.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800"
          onClick={() => setAuditOpen((o) => !o)}
        >
          Audit formules — Année 1
          {auditOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {auditOpen && (
          <div className="space-y-2 border-t border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">
            <p>
              Quantité produite = {formatNumber(y1Audit.sold, { maximumFractionDigits: 0 })}{" "}
              ventes + {formatNumber(y1Audit.closingPf, { maximumFractionDigits: 0 })} stock PF ={" "}
              {formatNumber(y1Audit.produced, { maximumFractionDigits: 0 })}
            </p>
            <p>
              Consommation = {formatNumber(y1Audit.produced, { maximumFractionDigits: 0 })} × 101%
              = {formatNumber(y1Audit.consumed, { maximumFractionDigits: 0 })}
            </p>
            <p>
              Achats = ({formatNumber(y1Audit.consumed, { maximumFractionDigits: 0 })} −{" "}
              {formatNumber(y1Audit.openingMp, { maximumFractionDigits: 0 })} SI) × 13/12 ={" "}
              {formatNumber(y1Audit.purchased, { maximumFractionDigits: 0 })}
            </p>
            <p>
              Stock final MP = {formatNumber(y1Audit.purchased, { maximumFractionDigits: 0 })} −{" "}
              {formatNumber(y1Audit.consumed, { maximumFractionDigits: 0 })} ={" "}
              {formatNumber(y1Audit.closingMp, { maximumFractionDigits: 0 })} (≈ 1 mois)
            </p>
            <p>Valeur achats MP Y1 = {formatCurrency(y1Audit.purchaseVal)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
