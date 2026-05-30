"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import KpiSummaryGrid from "@/components/dashboard/KpiSummaryGrid";
import ResponsiveScroll from "@/components/ui/ResponsiveScroll";

interface Results {
  revenue?: { years: number[] };
  netProfit?: { years: number[] };
  cumulativeTreasury?: { years: number[] };
  distributionExpense?: { years: number[] };
  marketingExpense?: { years: number[] };
  indicators?: { van: number; tri?: number; drciYears?: number };
  cashRunwayBreakYear?: number | null;
  bfrCoherent?: boolean;
  balanceSheetBalanced?: boolean;
}

function fmtNum(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-TN", { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "N/A";
  return `${(n * 100).toFixed(2)} %`;
}

type Props = {
  results: Results | null;
  defaultExpanded?: boolean;
};

export default function ResultsPanel({ results, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!results) {
    return (
      <p className="text-sm text-navy-500">
        Aucun résultat — lancez un calcul depuis les actions du plan.
      </p>
    );
  }

  const ind = results.indicators;
  const van = ind?.van;
  const tri = ind?.tri;
  const drci = ind?.drciYears;
  const runway = results.cashRunwayBreakYear;
  const years = results.netProfit?.years ?? [];

  return (
    <div className="space-y-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-start"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-navy-900">
            Indicateurs de rentabilité
          </h3>
          <p className="mt-0.5 text-sm text-navy-600">
            VAN, TRI, DRCI et projection 7 ans —{" "}
            {expanded ? "réduire" : "cliquer pour déplier"}
          </p>
          {!expanded && (
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-700 sm:gap-x-6">
              <div className="flex gap-1.5">
                <dt className="text-navy-500">VAN</dt>
                <dd className="font-semibold tabular-nums">{fmtNum(van)} TND</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-navy-500">TRI</dt>
                <dd className="font-semibold tabular-nums">{fmtPct(tri)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-navy-500">DRCI</dt>
                <dd className="font-semibold tabular-nums">
                  {drci != null ? `${drci.toFixed(1)} ans` : "N/A"}
                </dd>
              </div>
              {runway != null && runway > 0 && (
                <div className="flex gap-1.5 text-red-600">
                  <dt>Trésorerie</dt>
                  <dd className="font-semibold">alerte an {runway}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
        <span className="mt-1 shrink-0 rounded-lg border border-navy-100 p-1.5 text-navy-600">
          {expanded ? (
            <ChevronUp className="h-5 w-5" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5" aria-hidden />
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5 border-t border-navy-100 pt-5">
          <KpiSummaryGrid>
            <DashboardKpiCard label="VAN (10 %)" value={`${fmtNum(van)} TND`} />
            <DashboardKpiCard label="TRI" value={fmtPct(tri)} />
            <DashboardKpiCard
              label="DRCI"
              value={drci != null ? `${drci.toFixed(1)} ans` : "N/A"}
            />
            {runway != null && runway > 0 && (
              <DashboardKpiCard
                label="Trésorerie"
                value={`Alerte année ${runway}`}
                className="border-red-200 bg-red-50/80"
                valueClassName="text-red-700"
              />
            )}
            {results.bfrCoherent != null && (
              <DashboardKpiCard
                label="BFR cohérent"
                value={results.bfrCoherent ? "Oui" : "Non"}
              />
            )}
            {results.balanceSheetBalanced != null && (
              <DashboardKpiCard
                label="Bilan équilibré"
                value={results.balanceSheetBalanced ? "Oui" : "Non"}
              />
            )}
            {results.distributionExpense?.years?.[0] != null && (
              <DashboardKpiCard
                label="Distribution (an 1)"
                value={`${fmtNum(results.distributionExpense.years[0])} TND`}
              />
            )}
            {results.marketingExpense?.years?.[0] != null && (
              <DashboardKpiCard
                label="Marketing (an 1)"
                value={`${fmtNum(results.marketingExpense.years[0])} TND`}
              />
            )}
          </KpiSummaryGrid>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-navy-800">
              Projection 7 ans
            </h4>
            <ResponsiveScroll minWidth={480}>
              <table className="data-table w-full min-w-[480px] text-sm">
                <thead>
                  <tr>
                    <th>Année</th>
                    <th className="num">CA</th>
                    <th className="num">Résultat net</th>
                    <th className="num">Trésorerie cum.</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((_, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className="num">{fmtNum(results.revenue?.years?.[i])}</td>
                      <td className="num">{fmtNum(results.netProfit?.years?.[i])}</td>
                      <td className="num">
                        {fmtNum(results.cumulativeTreasury?.years?.[i])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveScroll>
          </div>
        </div>
      )}
    </div>
  );
}

