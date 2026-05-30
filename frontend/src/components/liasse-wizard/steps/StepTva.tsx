"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import TvaWaterfallChart from "@/components/liasse-wizard/TvaWaterfallChart";
import { useFormat } from "@/hooks/useFormat";
import {
  downloadTvaExport,
  getTvaProjection,
  listTvaConfig,
  TVA_RATE_OPTIONS,
  updateTvaConfig,
  type TvaConfigRow,
  type TvaProjection,
} from "@/lib/tva-api";

type Props = {
  planId: string;
  readOnly?: boolean;
};

const YEARS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function StepTva({ planId, readOnly }: Props) {
  const { formatCurrency } = useFormat();
  const [configs, setConfigs] = useState<TvaConfigRow[]>([]);
  const [projection, setProjection] = useState<TvaProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setConfigs(await listTvaConfig(planId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const refreshProjection = useCallback(async () => {
    try {
      setProjection(await getTvaProjection(planId));
    } catch {
      setProjection(null);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshProjection(), 500);
    return () => window.clearTimeout(t);
  }, [configs, refreshProjection]);

  const productConfigs = useMemo(
    () => configs.filter((c) => c.category === "product"),
    [configs]
  );
  const systemConfigs = useMemo(
    () => configs.filter((c) => c.category !== "product"),
    [configs]
  );

  const persistRow = async (row: TvaConfigRow) => {
    setSaving(true);
    try {
      const saved = await updateTvaConfig(planId, [
        {
          id: row.id,
          label: row.label,
          tva_rate_purchase: row.tva_rate_purchase,
          tva_rate_sales: row.tva_rate_sales,
          enabled: row.enabled,
        },
      ]);
      if (saved[0]) {
        setConfigs((list) => list.map((c) => (c.id === saved[0].id ? saved[0] : c)));
      }
      void refreshProjection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const patchLocal = (id: string, patch: Partial<TvaConfigRow>) => {
    setConfigs((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const renderConfigTable = (rows: TvaConfigRow[], title: string) => (
    <div className="mb-6">
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-600">
        {title}
      </h5>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-navy-100 text-xs text-navy-700">
            <tr>
              <th className="px-2 py-2">Ligne</th>
              <th className="px-2 py-2">TVA achat</th>
              <th className="px-2 py-2">TVA vente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-navy-50">
                <td className="px-2 py-2 font-medium text-navy-900">{row.label}</td>
                <td className="px-2 py-2">
                  <select
                    className="rounded border border-navy-200 px-2 py-1 text-sm"
                    disabled={readOnly}
                    value={row.tva_rate_purchase}
                    onChange={(e) =>
                      patchLocal(row.id, { tva_rate_purchase: Number(e.target.value) })
                    }
                    onBlur={() => {
                      const cur = configs.find((c) => c.id === row.id);
                      if (cur) void persistRow(cur);
                    }}
                  >
                    {TVA_RATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select
                    className="rounded border border-navy-200 px-2 py-1 text-sm"
                    disabled={readOnly || row.category !== "product"}
                    value={row.tva_rate_sales}
                    onChange={(e) =>
                      patchLocal(row.id, { tva_rate_sales: Number(e.target.value) })
                    }
                    onBlur={() => {
                      const cur = configs.find((c) => c.id === row.id);
                      if (cur) void persistRow(cur);
                    }}
                  >
                    {TVA_RATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-navy-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-navy-600">
        Tableau de réconciliation TVA (collectée / déductible / solde) selon la Liasse Unique :
        taux par produit et par poste d&apos;achat, soldes fournisseurs et clients (1 mois TTC).
      </p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <h4 className="mb-4 text-sm font-semibold text-navy-800">Configuration des taux TVA</h4>
        {renderConfigTable(productConfigs, "Ventes & matières premières (par produit)")}
        {renderConfigTable(systemConfigs, "Achats & charges (plan)")}
      </section>

      <TvaWaterfallChart projection={projection} />

      {projection && (
        <>
          <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-navy-800">Solde TVA par année</h4>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-xs text-navy-700">
                  <th className="px-2 py-2">Année</th>
                  <th className="px-2 py-2 text-end">TVA collectée</th>
                  <th className="px-2 py-2 text-end">TVA déductible</th>
                  <th className="px-2 py-2 text-end">Solde net</th>
                  <th className="px-2 py-2 text-end">Créances clients (1 mois)</th>
                  <th className="px-2 py-2 text-end">Dettes fournisseurs (1 mois)</th>
                </tr>
              </thead>
              <tbody>
                {projection.by_year.map((y) => (
                  <tr key={y.year} className="border-b border-navy-50">
                    <td className="px-2 py-2 font-medium">Y{y.year}</td>
                    <td className="px-2 py-2 text-end tabular-nums">
                      {formatCurrency(y.tva_collectee)}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums">
                      {formatCurrency(y.tva_deductible)}
                    </td>
                    <td
                      className={`px-2 py-2 text-end font-semibold tabular-nums ${
                        y.is_credit ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCurrency(y.solde_tva)}
                      {y.is_credit ? " (crédit)" : ""}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums">
                      {formatCurrency(y.customer_receivables)}
                    </td>
                    <td className="px-2 py-2 text-end tabular-nums">
                      {formatCurrency(y.supplier_payables)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-navy-800">
              Détail TVA collectée / déductible par année
            </h4>
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-navy-700">
                  <th className="px-2 py-2">Poste</th>
                  {YEARS.map((y) => (
                    <th key={y} className="px-2 py-2 text-end">
                      Col. Y{y}
                    </th>
                  ))}
                  {YEARS.map((y) => (
                    <th key={`d${y}`} className="px-2 py-2 text-end text-red-800">
                      Déd. Y{y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg) => {
                  const collKey = cfg.category === "product" ? `sales:${cfg.applies_to}` : null;
                  const dedKey =
                    cfg.category === "product"
                      ? `purchase:mp:${cfg.applies_to}`
                      : `purchase:${cfg.applies_to}`;
                  return (
                    <tr key={cfg.id} className="border-b border-navy-50">
                      <td className="max-w-[10rem] truncate px-2 py-1.5">{cfg.label}</td>
                      {YEARS.map((y) => {
                        const row = projection.by_year.find((b) => b.year === y);
                        const v = collKey ? row?.collectee_by_line?.[collKey] ?? 0 : 0;
                        return (
                          <td key={y} className="px-2 py-1.5 text-end tabular-nums text-green-800">
                            {collKey ? formatCurrency(v) : "—"}
                          </td>
                        );
                      })}
                      {YEARS.map((y) => {
                        const row = projection.by_year.find((b) => b.year === y);
                        const v = row?.deductible_by_line?.[dedKey] ?? 0;
                        return (
                          <td key={`d${y}`} className="px-2 py-1.5 text-end tabular-nums">
                            {formatCurrency(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void downloadTvaExport(planId, "csv")}
          className="inline-flex items-center gap-2 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800"
        >
          <Download className="h-4 w-4" />
          Export CSV (Liasse)
        </button>
        <button
          type="button"
          onClick={() => void downloadTvaExport(planId, "html")}
          className="inline-flex items-center gap-2 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800"
        >
          <Download className="h-4 w-4" />
          Aperçu HTML
        </button>
      </div>
    </div>
  );
}
