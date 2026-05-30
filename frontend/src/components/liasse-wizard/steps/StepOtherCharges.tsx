"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useFormat } from "@/hooks/useFormat";
import {
  CATEGORY_LABELS_FR,
  getOtherChargesProjection,
  getOtherChargesSettings,
  listOtherChargesConfig,
  RULE_OPTIONS,
  syncOtherChargesToLiasse,
  updateOtherChargesConfig,
  updateOtherChargesSettings,
  type OtherChargeRuleType,
  type OtherChargesConfigRow,
  type OtherChargesProjection,
} from "@/lib/other-charges-api";

type Props = {
  planId: string;
  readOnly?: boolean;
  onDataChange?: () => void;
};

const YEARS = [1, 2, 3, 4, 5, 6, 7] as const;
const PAYROLL_CATS = new Set(["tfp", "foprolo"]);

export default function StepOtherCharges({ planId, readOnly, onDataChange }: Props) {
  const { formatCurrency, formatPercent } = useFormat();
  const [configs, setConfigs] = useState<OtherChargesConfigRow[]>([]);
  const [lf2012, setLf2012] = useState(true);
  const [projection, setProjection] = useState<OtherChargesProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [rows, settings] = await Promise.all([
        listOtherChargesConfig(planId),
        getOtherChargesSettings(planId),
      ]);
      setConfigs(rows);
      setLf2012(settings.lf2012_exemption_5y);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
      onDataChange?.();
    }
  }, [planId, onDataChange]);

  const refreshProjection = useCallback(async () => {
    try {
      setProjection(await getOtherChargesProjection(planId));
    } catch {
      setProjection(null);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshProjection(), 450);
    return () => window.clearTimeout(t);
  }, [configs, lf2012, refreshProjection]);

  const amountGrid = useMemo(() => {
    const grid: Record<string, Record<number, number>> = {};
    if (!projection?.by_year) return grid;
    for (const y of projection.by_year) {
      for (const [cat, amt] of Object.entries(y.by_category)) {
        grid[cat] = grid[cat] ?? {};
        grid[cat][y.year] = amt;
      }
    }
    return grid;
  }, [projection]);

  const persistRow = async (row: OtherChargesConfigRow) => {
    setSaving(true);
    try {
      const saved = await updateOtherChargesConfig(planId, [
        {
          id: row.id,
          rule_type: row.rule_type,
          base_value: row.base_value,
          rate_or_pct: row.rate_or_pct,
          inflation_rate: row.inflation_rate,
          enabled: row.enabled,
        },
      ]);
      const updated = saved[0];
      if (updated) {
        setConfigs((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      }
      void refreshProjection();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const patchLocal = (id: string, patch: Partial<OtherChargesConfigRow>) => {
    setConfigs((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const toggleLf2012 = async (checked: boolean) => {
    setLf2012(checked);
    await updateOtherChargesSettings(planId, { lf2012_exemption_5y: checked });
    void refreshProjection();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await syncOtherChargesToLiasse(planId);
      setSyncMsg(
        `${res.message} — ${formatCurrency(res.other_operating_charges_y1)} en Y1`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSyncing(false);
    }
  };

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
        Onze postes de charges d&apos;exploitation calculés selon les règles du modèle Excel
        (% CA, % investissement, forfait indexé, % masse salariale). Les montants se
        recalculent à partir du CA, des investissements et de la masse salariale du plan.
      </p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {syncMsg && <p className="text-sm text-green-700">{syncMsg}</p>}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <input
          type="checkbox"
          className="mt-1"
          checked={lf2012}
          disabled={readOnly}
          onChange={(e) => void toggleLf2012(e.target.checked)}
        />
        <span className="text-sm text-navy-800">
          <strong>Exonération 5 ans — LF 2012</strong> (TFP et FOPROLOS à zéro en Y1–Y5)
        </span>
      </label>

      {projection && (
        <div className="grid gap-3 text-xs text-navy-600 sm:grid-cols-3">
          <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2">
            Investissement total :{" "}
            <strong>{formatCurrency(projection.investment_total)}</strong>
          </div>
          <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2">
            CA net Y1 :{" "}
            <strong>{formatCurrency(projection.revenue_series[0] ?? 0)}</strong>
          </div>
          <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-3 py-2">
            Masse salariale Y1 :{" "}
            <strong>{formatCurrency(projection.payroll_series[0] ?? 0)}</strong>
          </div>
        </div>
      )}

      <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-navy-100 bg-navy-50/80 text-xs font-semibold text-navy-800">
            <tr>
              <th className="px-3 py-2">Catégorie</th>
              <th className="px-3 py-2">Règle</th>
              <th className="px-3 py-2">%</th>
              <th className="px-3 py-2">Forfait (TND)</th>
              <th className="px-3 py-2">Inflation/an</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((row) => {
              const isFixed = row.rule_type === "fixed_inflation";
              const isPct = !isFixed;
              return (
                <tr key={row.id} className="border-b border-navy-50">
                  <td className="px-3 py-2 font-medium text-navy-900">
                    {CATEGORY_LABELS_FR[row.category] ?? row.category}
                    {PAYROLL_CATS.has(row.category) && lf2012 && (
                      <span className="ms-1 text-[10px] text-amber-700">(LF 2012)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full min-w-[10rem] rounded border border-navy-200 px-2 py-1 text-sm"
                      disabled={readOnly}
                      value={row.rule_type}
                      onChange={(e) => {
                        const rule_type = e.target.value as OtherChargeRuleType;
                        patchLocal(row.id, { rule_type });
                      }}
                      onBlur={() => {
                        const cur = configs.find((c) => c.id === row.id);
                        if (cur) void persistRow(cur);
                      }}
                    >
                      {RULE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={readOnly || !isPct}
                      className="w-20 rounded border border-navy-200 px-2 py-1 disabled:bg-navy-50"
                      value={isPct ? Math.round(row.rate_or_pct * 10000) / 100 : ""}
                      placeholder="—"
                      onChange={(e) =>
                        patchLocal(row.id, {
                          rate_or_pct: Number(e.target.value) / 100,
                        })
                      }
                      onBlur={() => {
                        if (!isPct) return;
                        const cur = configs.find((c) => c.id === row.id);
                        if (cur) void persistRow(cur);
                      }}
                    />
                    {isPct && (
                      <span className="ms-1 text-xs text-navy-500">%</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      disabled={readOnly || !isFixed}
                      className="w-28 rounded border border-navy-200 px-2 py-1 disabled:bg-navy-50"
                      value={isFixed ? row.base_value : ""}
                      placeholder="—"
                      onChange={(e) =>
                        patchLocal(row.id, { base_value: Number(e.target.value) })
                      }
                      onBlur={() => {
                        if (!isFixed) return;
                        const cur = configs.find((c) => c.id === row.id);
                        if (cur) void persistRow(cur);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={readOnly}
                      className="w-16 rounded border border-navy-200 px-2 py-1"
                      value={Math.round(row.inflation_rate * 1000) / 10}
                      onChange={(e) =>
                        patchLocal(row.id, {
                          inflation_rate: Number(e.target.value) / 100,
                        })
                      }
                      onBlur={() => {
                        const cur = configs.find((c) => c.id === row.id);
                        if (cur) void persistRow(cur);
                      }}
                    />
                    <span className="ms-1 text-xs text-navy-500">%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">
          Projection 7 ans (calcul automatique)
        </h4>
        {!projection ? (
          <p className="text-sm text-navy-500">Projection indisponible.</p>
        ) : (
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-navy-700">
                <th className="px-2 py-2">Poste</th>
                {YEARS.map((y) => (
                  <th key={y} className="px-2 py-2 text-end">
                    Y{y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configs.map((row) => (
                <tr key={row.id} className="border-b border-navy-50">
                  <td className="px-2 py-1.5 text-navy-800">
                    {CATEGORY_LABELS_FR[row.category] ?? row.category}
                  </td>
                  {YEARS.map((y) => (
                    <td key={y} className="px-2 py-1.5 text-end tabular-nums">
                      {formatCurrency(amountGrid[row.category]?.[y] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-navy-50/80 font-semibold text-navy-900">
                <td className="px-2 py-2">Total</td>
                {YEARS.map((y) => {
                  const sum = projection.by_year.find((b) => b.year === y)?.total ?? 0;
                  return (
                    <td key={y} className="px-2 py-2 text-end tabular-nums">
                      {formatCurrency(sum)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {!readOnly && (
        <button
          type="button"
          disabled={syncing || saving}
          onClick={() => void handleSync()}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-900"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Synchroniser avec la liasse (autres charges Y1)
        </button>
      )}
    </div>
  );
}
