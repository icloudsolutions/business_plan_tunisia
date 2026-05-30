"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import PayrollCharts from "@/components/liasse-wizard/PayrollCharts";
import { useFormat } from "@/hooks/useFormat";
import {
  createStaffRole,
  deleteStaffRole,
  downloadPayrollExport,
  getPayrollAssumptions,
  getPayrollProjection,
  listHeadcount,
  listStaffRoles,
  syncPayrollToLiasse,
  updatePayrollAssumptions,
  updateStaffRole,
  upsertHeadcount,
  type PayrollProjection,
  type StaffRole,
} from "@/lib/payroll-api";

type Props = {
  planId: string;
  readOnly?: boolean;
  onDataChange?: () => void;
};

const YEARS = [1, 2, 3, 4, 5, 6, 7] as const;

function hcKey(roleId: string, year: number) {
  return `${roleId}:${year}`;
}

export default function StepHr({ planId, readOnly, onDataChange }: Props) {
  const t = useTranslations("modules");
  const { formatCurrency, formatPercent } = useFormat();
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [headcounts, setHeadcounts] = useState<Record<string, number>>({});
  const [raiseRate, setRaiseRate] = useState(0.06);
  const [cnssRate, setCnssRate] = useState(0.1897);
  const [projection, setProjection] = useState<PayrollProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [r, hc, assump] = await Promise.all([
        listStaffRoles(planId),
        listHeadcount(planId),
        getPayrollAssumptions(planId),
      ]);
      setRoles(r);
      const map: Record<string, number> = {};
      for (const e of hc) {
        map[hcKey(e.staff_role_id, e.year)] = e.headcount;
      }
      setHeadcounts(map);
      setRaiseRate(assump.annual_raise_rate);
      setCnssRate(assump.cnss_employer_rate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const refreshProjection = useCallback(async () => {
    try {
      setProjection(await getPayrollProjection(planId));
    } catch {
      setProjection(null);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshProjection(), 900);
    return () => window.clearTimeout(t);
  }, [roles, headcounts, raiseRate, cnssRate, refreshProjection]);

  const getHc = (roleId: string, year: number) => {
    const k = hcKey(roleId, year);
    if (k in headcounts) return headcounts[k];
    const y1 = headcounts[hcKey(roleId, 1)];
    if (year > 1 && y1 !== undefined) return y1;
    return year === 1 ? 1 : 0;
  };

  const summaryY1 = useMemo(
    () => projection?.by_year?.find((y) => y.year === 1),
    [projection]
  );

  const saveAssumptions = async (patch: {
    annual_raise_rate?: number;
    cnss_employer_rate?: number;
  }) => {
    const row = await updatePayrollAssumptions(planId, patch);
    setRaiseRate(row.annual_raise_rate);
    setCnssRate(row.cnss_employer_rate);
    void refreshProjection();
    onDataChange?.();
  };

  const persistHeadcount = async (
    items: { staff_role_id: string; year: number; headcount: number }[]
  ) => {
    if (!items.length) return;
    setSaving(true);
    try {
      const saved = await upsertHeadcount(planId, items);
      const map = { ...headcounts };
      for (const e of saved) {
        map[hcKey(e.staff_role_id, e.year)] = e.headcount;
      }
      setHeadcounts(map);
      void refreshProjection();
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const addRole = async () => {
    setSaving(true);
    try {
      const row = await createStaffRole(planId, {
        function_name: "Nouveau poste",
        qualification: "",
        base_monthly_salary: 0,
        is_production_imputable: true,
        headcount_y1: 1,
      });
      setRoles((list) => [...list, row]);
      const y1 = 1;
      setHeadcounts((m) => ({ ...m, [hcKey(row.id, 1)]: y1 }));
      void refreshProjection();
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (id: string) => {
    await deleteStaffRole(planId, id);
    setRoles((list) => list.filter((r) => r.id !== id));
    void refreshProjection();
    onDataChange?.();
  };

  const patchRole = async (id: string, patch: Parameters<typeof updateStaffRole>[2]) => {
    const row = await updateStaffRole(planId, id, patch);
    setRoles((list) => list.map((r) => (r.id === id ? row : r)));
    void refreshProjection();
    onDataChange?.();
  };

  const handleSyncLiasse = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await syncPayrollToLiasse(planId);
      setSyncMsg(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-navy-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-navy-600">{t("hrIntro")}</p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {syncMsg && <p className="text-sm text-green-700">{syncMsg}</p>}

      <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <h4 className="mb-4 text-sm font-semibold text-navy-800">{t("hrGlobalAssumptions")}</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-navy-700">
              Augmentation annuelle ({formatPercent(raiseRate)})
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              disabled={readOnly}
              value={raiseRate * 100}
              className="mt-2 w-full"
              onChange={(e) => setRaiseRate(Number(e.target.value) / 100)}
              onMouseUp={(e) =>
                void saveAssumptions({
                  annual_raise_rate: Number(e.currentTarget.value) / 100,
                })
              }
              onTouchEnd={(e) =>
                void saveAssumptions({
                  annual_raise_rate: Number(e.currentTarget.value) / 100,
                })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-navy-700">
              CNSS employeur ({formatPercent(cnssRate)})
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
              value={Math.round(cnssRate * 10000) / 100}
              onBlur={(e) =>
                void saveAssumptions({ cnss_employer_rate: Number(e.target.value) / 100 })
              }
              onChange={(e) => setCnssRate(Number(e.target.value) / 100)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-navy-800">Postes &amp; salaires</h4>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void addRole()}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm font-medium text-navy-800"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Ajouter un poste
            </button>
          )}
        </div>

        {roles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-navy-200 px-4 py-6 text-center text-sm text-navy-500">
            Aucun poste — ajoutez au moins un rôle pour la masse salariale.
          </p>
        ) : (
          <div className="space-y-4">
            {roles.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-navy-100 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-navy-700">Fonction</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      disabled={readOnly}
                      value={r.function_name}
                      onChange={(e) =>
                        setRoles((list) =>
                          list.map((x) =>
                            x.id === r.id ? { ...x, function_name: e.target.value } : x
                          )
                        )
                      }
                      onBlur={(e) =>
                        void patchRole(r.id, { function_name: e.target.value.trim() })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">Qualification</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      disabled={readOnly}
                      value={r.qualification}
                      onBlur={(e) =>
                        void patchRole(r.id, { qualification: e.target.value })
                      }
                      onChange={(e) =>
                        setRoles((list) =>
                          list.map((x) =>
                            x.id === r.id ? { ...x, qualification: e.target.value } : x
                          )
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy-700">
                      Salaire mensuel (TND)
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      disabled={readOnly}
                      value={r.base_monthly_salary}
                      onBlur={(e) =>
                        void patchRole(r.id, {
                          base_monthly_salary: Number(e.target.value),
                        })
                      }
                      onChange={(e) =>
                        setRoles((list) =>
                          list.map((x) =>
                            x.id === r.id
                              ? { ...x, base_monthly_salary: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-navy-700">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={r.is_production_imputable}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setRoles((list) =>
                            list.map((x) =>
                              x.id === r.id ? { ...x, is_production_imputable: v } : x
                            )
                          );
                          void patchRole(r.id, { is_production_imputable: v });
                        }}
                      />
                      Imputable production
                    </label>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => void removeRole(r.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-navy-700">
                      Augmentation spécifique (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      placeholder={`Défaut ${formatPercent(raiseRate)}`}
                      className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                      disabled={readOnly}
                      value={
                        r.annual_raise_rate_override != null
                          ? Math.round(r.annual_raise_rate_override * 1000) / 10
                          : ""
                      }
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        void patchRole(r.id, {
                          annual_raise_rate_override: raw
                            ? Number(raw) / 100
                            : null,
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <p className="mb-2 text-xs font-medium text-navy-700">
                    Effectifs par année
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {YEARS.map((y) => (
                      <div key={y} className="w-16">
                        <span className="text-[10px] text-navy-500">Y{y}</span>
                        <input
                          type="number"
                          min={0}
                          disabled={readOnly}
                          className="mt-0.5 w-full rounded border border-navy-200 px-2 py-1 text-sm"
                          value={getHc(r.id, y)}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setHeadcounts((m) => ({
                              ...m,
                              [hcKey(r.id, y)]: v,
                            }));
                          }}
                          onBlur={(e) =>
                            void persistHeadcount([
                              {
                                staff_role_id: r.id,
                                year: y,
                                headcount: Number(e.target.value),
                              },
                            ])
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {summaryY1 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4">
            <p className="text-xs text-navy-600">Effectifs Y1</p>
            <p className="text-xl font-semibold text-navy-900">
              {summaryY1.total_headcount}
            </p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4">
            <p className="text-xs text-navy-600">Masse salariale Y1</p>
            <p className="text-xl font-semibold text-navy-900">
              {formatCurrency(summaryY1.total_payroll)}
            </p>
          </div>
          <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4">
            <p className="text-xs text-navy-600">CNSS Y1</p>
            <p className="text-xl font-semibold text-navy-900">
              {formatCurrency(summaryY1.cnss)}
            </p>
          </div>
        </div>
      )}

      <PayrollCharts projection={projection} />

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncing || saving}
            onClick={() => void handleSyncLiasse()}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-900"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Synchroniser avec la liasse
          </button>
          <button
            type="button"
            onClick={() => void downloadPayrollExport(planId, "csv")}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800"
          >
            <Download className="h-4 w-4" />
            Export CSV (PDF)
          </button>
          <button
            type="button"
            onClick={() => void downloadPayrollExport(planId, "html")}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-800"
          >
            <Download className="h-4 w-4" />
            Aperçu HTML
          </button>
        </div>
      )}
    </div>
  );
}
