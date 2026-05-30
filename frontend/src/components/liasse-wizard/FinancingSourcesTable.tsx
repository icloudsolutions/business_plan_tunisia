"use client";

import { useFormat } from "@/hooks/useFormat";
import type {
  FinancingSourceDetail,
  FinancingStructureProjection,
} from "@/lib/financing-structure-api";

type Props = {
  projection: FinancingStructureProjection | null;
  readOnly?: boolean;
  saving?: boolean;
  onUpdate: (
    sourceId: string,
    patch: Partial<{
      label: string;
      amount: number;
      rate: number;
      term_years: number;
      grace_months: number;
    }>
  ) => void;
};

const DEBT_TYPES = new Set(["cmt", "leasing"]);

function showLoanFields(sourceType: string, rate: number): boolean {
  return DEBT_TYPES.has(sourceType) || (sourceType === "autre" && rate > 0);
}

export default function FinancingSourcesTable({
  projection,
  readOnly,
  saving,
  onUpdate,
}: Props) {
  const { formatCurrency, formatPercent } = useFormat();
  const rows = projection?.sources_detail ?? [];
  const summary = projection?.summary;

  if (!rows.length) return null;

  return (
    <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-navy-800">Sources de financement</h4>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-navy-100 text-xs text-navy-600">
            <th className="px-2 py-2 text-start">Source</th>
            <th className="px-2 py-2 text-end">Montant (TND)</th>
            <th className="px-2 py-2 text-end">%</th>
            <th className="px-2 py-2 text-end">Taux</th>
            <th className="px-2 py-2 text-end">Durée (ans)</th>
            <th className="px-2 py-2 text-end">Franchise (mois)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <FinancingSourceRow
              key={row.id}
              row={row}
              readOnly={readOnly}
              saving={saving}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              onUpdate={onUpdate}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-navy-200 bg-navy-50/50 font-medium">
            <td className="px-2 py-2">Total sources</td>
            <td className="px-2 py-2 text-end tabular-nums">
              {formatCurrency(summary?.total_sources_amount ?? 0)}
            </td>
            <td className="px-2 py-2 text-end">100 %</td>
            <td colSpan={3} />
          </tr>
          <tr
            className={
              summary?.is_balanced
                ? "bg-green-50/80 text-green-800"
                : "bg-amber-50/80 text-amber-900"
            }
          >
            <td className="px-2 py-2 font-semibold">Écart (GAP)</td>
            <td className="px-2 py-2 text-end font-semibold tabular-nums" colSpan={2}>
              {formatCurrency(summary?.gap ?? 0)}
              {summary?.is_balanced ? " — équilibré ✓" : " — à combler"}
            </td>
            <td colSpan={3} className="px-2 py-2 text-xs">
              Doit être 0 (sources = investissement + BFR initial)
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function FinancingSourceRow({
  row,
  readOnly,
  saving,
  formatCurrency,
  formatPercent,
  onUpdate,
}: {
  row: FinancingSourceDetail;
  readOnly?: boolean;
  saving?: boolean;
  formatCurrency: (n: number) => string;
  formatPercent: (n: number) => string;
  onUpdate: Props["onUpdate"];
}) {
  const loanFields = showLoanFields(row.source_type, row.rate);

  const patchAndSave = (patch: Parameters<Props["onUpdate"]>[1]) => {
    onUpdate(row.id, patch);
  };

  return (
    <tr className="border-b border-navy-50">
      <td className="px-2 py-2">
        <input
          className="w-full min-w-[8rem] rounded border border-navy-200 px-2 py-1 text-sm disabled:bg-navy-50"
          disabled={readOnly || row.source_type === "fonds_propres"}
          defaultValue={row.label}
          onBlur={(e) => {
            if (e.target.value !== row.label) patchAndSave({ label: e.target.value });
          }}
        />
        <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-navy-400">
          {row.source_type.replace("_", " ")}
        </span>
      </td>
      <td className="px-2 py-2 text-end">
        <input
          type="number"
          min={0}
          step={1000}
          disabled={readOnly || saving}
          className="w-28 rounded border border-navy-200 px-2 py-1 text-end text-sm tabular-nums"
          defaultValue={row.amount}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v) && v !== row.amount) patchAndSave({ amount: v });
          }}
        />
      </td>
      <td className="px-2 py-2 text-end tabular-nums text-navy-600">
        {formatPercent((row.share_pct ?? 0) / 100)}
      </td>
      <td className="px-2 py-2 text-end">
        {loanFields ? (
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            disabled={readOnly || saving}
            className="w-16 rounded border border-navy-200 px-2 py-1 text-end text-sm"
            defaultValue={Math.round(row.rate * 1000) / 10}
            onBlur={(e) => {
              const v = Number(e.target.value) / 100;
              if (!Number.isNaN(v) && v !== row.rate) patchAndSave({ rate: v });
            }}
          />
        ) : (
          <span className="text-navy-400">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-end">
        {loanFields ? (
          <input
            type="number"
            min={1}
            max={30}
            disabled={readOnly || saving}
            className="w-14 rounded border border-navy-200 px-2 py-1 text-end text-sm"
            defaultValue={row.term_years || 7}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v !== row.term_years) patchAndSave({ term_years: v });
            }}
          />
        ) : (
          <span className="text-navy-400">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-end">
        {loanFields ? (
          <input
            type="number"
            min={0}
            max={120}
            disabled={readOnly || saving}
            className="w-14 rounded border border-navy-200 px-2 py-1 text-end text-sm"
            defaultValue={row.grace_months}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v !== row.grace_months) patchAndSave({ grace_months: v });
            }}
          />
        ) : (
          <span className="text-navy-400">—</span>
        )}
      </td>
    </tr>
  );
}
