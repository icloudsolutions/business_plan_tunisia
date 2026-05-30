"use client";

import { useFormat } from "@/hooks/useFormat";
import type { FinancingStructureProjection } from "@/lib/financing-structure-api";

type Props = {
  projection: FinancingStructureProjection | null;
};

export default function FinancingInvestmentSummary({ projection }: Props) {
  const { formatCurrency } = useFormat();
  const inv = projection?.investment;
  const summary = projection?.summary;

  if (!inv) return null;

  return (
    <section className="rounded-xl border border-navy-100 bg-gradient-to-br from-navy-50/80 to-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-navy-800">
        Besoin de financement (Investissements + BFR initial)
      </h4>
      <dl className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-navy-100 bg-white px-3 py-2">
          <dt className="text-xs text-navy-500">Immobilisations (capex)</dt>
          <dd className="text-lg font-semibold tabular-nums text-navy-900">
            {formatCurrency(inv.fixed_assets_total)}
          </dd>
        </div>
        <div className="rounded-lg border border-navy-100 bg-white px-3 py-2">
          <dt className="text-xs text-navy-500">BFR initial (Y1, opérations)</dt>
          <dd className="text-lg font-semibold tabular-nums text-navy-900">
            {formatCurrency(inv.initial_bfr)}
          </dd>
        </div>
        <div className="rounded-lg border border-gold-200 bg-gold-50/60 px-3 py-2">
          <dt className="text-xs font-medium text-navy-700">Total besoin de financement</dt>
          <dd className="text-lg font-bold tabular-nums text-navy-900">
            {formatCurrency(inv.total_financing_need)}
          </dd>
        </div>
      </dl>
      {summary && (
        <p className="mt-2 text-xs text-navy-500">
          Sources saisies : {formatCurrency(summary.total_sources_amount)} — écart{" "}
          <span
            className={
              summary.is_balanced ? "font-medium text-green-700" : "font-medium text-amber-700"
            }
          >
            {formatCurrency(summary.gap)}
          </span>
        </p>
      )}
    </section>
  );
}
