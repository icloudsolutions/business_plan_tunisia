"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import BalanceCompositionChart from "@/components/finance-live/BalanceCompositionChart";
import { useFormat } from "@/hooks/useFormat";
import {
  fetchBalanceSheet,
  type BalanceLineItem,
  type BalanceSheetProjection,
  type BalanceSheetYear,
} from "@/lib/finance/balance-sheet-api";

type Props = {
  planId: string;
  scenario?: "base" | "pessimistic" | "optimistic";
};

function LineTree({ items, depth = 0 }: { items: BalanceLineItem[]; depth?: number }) {
  const { formatCurrency } = useFormat();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <ul className={depth === 0 ? "space-y-0.5" : "ms-3 border-s border-navy-100 ps-2"}>
      {items.map((item) => {
        const hasKids = item.children.length > 0;
        const isOpen = open[item.key] ?? depth < 1;
        return (
          <li key={item.key}>
            <div
              className={`flex items-center justify-between gap-2 py-1 text-sm ${
                depth === 0 ? "font-medium text-navy-800" : "text-navy-700"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1">
                {hasKids ? (
                  <button
                    type="button"
                    className="shrink-0 text-navy-500"
                    onClick={() => setOpen((o) => ({ ...o, [item.key]: !isOpen }))}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatCurrency(item.amount)}</span>
            </div>
            {hasKids && isOpen && <LineTree items={item.children} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}

function SidePanel({ side, accent }: { side: BalanceSheetYear["assets"]; accent: string }) {
  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <div className="mb-3 flex items-center justify-between border-b border-navy-100 pb-2">
        <h4 className="text-sm font-bold uppercase tracking-wide text-navy-800">{side.title}</h4>
        <span className="text-sm font-semibold tabular-nums text-navy-900">
          {side.total.toLocaleString("fr-TN", { maximumFractionDigits: 0 })} DT
        </span>
      </div>
      {side.sections.map((section) => (
        <div key={section.key} className="mb-4 last:mb-0">
          <LineTree items={[section]} />
        </div>
      ))}
    </div>
  );
}

function RatioCards({ year }: { year: BalanceSheetYear }) {
  const { formatCurrency, formatPercent } = useFormat();
  const r = year.ratios;
  const cards = [
    {
      label: "Endettement (LT / CP)",
      value: r.endettement != null ? formatPercent(r.endettement) : "—",
    },
    {
      label: "Liquidité (AC / CT)",
      value: r.liquidite != null ? r.liquidite.toFixed(2) : "—",
    },
    { label: "Fonds de roulement", value: formatCurrency(r.fonds_roulement) },
    { label: "BFR", value: formatCurrency(r.bfr) },
    { label: "Trésorerie nette", value: formatCurrency(r.tresorerie_nette) },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2"
        >
          <p className="text-[10px] font-medium uppercase text-navy-600">{c.label}</p>
          <p className="text-sm font-semibold tabular-nums text-navy-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function BalanceSheetTab({
  planId,
  scenario = "base",
}: Props) {
  const { formatCurrency } = useFormat();
  const [projection, setProjection] = useState<BalanceSheetProjection | null>(null);
  const [year, setYear] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setProjection(await fetchBalanceSheet(planId, scenario));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [planId, scenario]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = projection?.years.find((y) => y.year === year);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-navy-600">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </p>
    );
  }

  if (!projection?.years?.length) {
    return (
      <p className="text-sm text-navy-600">
        Aucune donnée de bilan — complétez la liasse et lancez un calcul.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              year === y
                ? "bg-navy-800 text-white"
                : "bg-white text-navy-700 ring-1 ring-navy-200 hover:bg-navy-50"
            }`}
          >
            Y{y}
          </button>
        ))}
      </div>

      {current && (
        <>
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
              current.balanced
                ? "bg-green-50 text-green-800 ring-1 ring-green-200"
                : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            }`}
          >
            {current.balanced ? (
              <>
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Bilan équilibré
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Écart : {formatCurrency(current.gap)}
              </>
            )}
          </div>

          <RatioCards year={current} />

          <div className="grid gap-4 lg:grid-cols-2">
            <SidePanel side={current.assets} accent="border-emerald-100 bg-emerald-50/20" />
            <SidePanel side={current.liabilities} accent="border-sky-100 bg-sky-50/20" />
          </div>
        </>
      )}

      <BalanceCompositionChart projection={projection} />

      <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">Synthèse annuelle</h4>
        <table className="min-w-full text-start text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs text-navy-600">
              <th className="px-2 py-2">Poste</th>
              {[1, 2, 3, 4, 5, 6, 7].map((y) => (
                <th key={y} className="px-2 py-2 text-end">
                  Y{y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-navy-50">
              <td className="px-2 py-2 font-medium">Total actif</td>
              {projection.years.map((y) => (
                <td key={y.year} className="px-2 py-2 text-end tabular-nums">
                  {formatCurrency(y.total_assets)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-navy-50">
              <td className="px-2 py-2 font-medium">Total passif</td>
              {projection.years.map((y) => (
                <td key={y.year} className="px-2 py-2 text-end tabular-nums">
                  {formatCurrency(y.total_liabilities_equity)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-2 py-2 font-medium">Encours emprunt (LT)</td>
              {projection.years.map((y) => {
                const lt = y.liabilities.sections.find((s) => s.key === "lt_debt");
                return (
                  <td key={y.year} className="px-2 py-2 text-end tabular-nums">
                    {formatCurrency(lt?.amount ?? 0)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
