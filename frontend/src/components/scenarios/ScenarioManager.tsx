"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Plus, Star } from "lucide-react";
import RoleGate from "@/components/auth/RoleGate";
import {
  calculateAllScenarios,
  calculateScenario,
  compareScenarios,
  createScenario,
  pollScenarioJob,
  setOfficialScenario,
  updateScenario,
  type PlanScenario,
  type ScenarioCompare,
  type ScenarioMultipliers,
} from "@/lib/scenarios-api";
import ScenarioComparisonChart from "./ScenarioComparisonChart";

type Props = {
  planId: string;
  readOnly?: boolean;
  onOfficialSet?: () => void;
};

const YEAR_LABELS = ["An 1", "An 2", "An 3", "An 4", "An 5", "An 6", "An 7"];

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 1 && n !== 0) return `${(n * 100).toFixed(2)} %`;
  return n.toLocaleString("fr-TN", { maximumFractionDigits: 0 });
}

export default function ScenarioManager({ planId, readOnly, onOfficialSet }: Props) {
  const [compare, setCompare] = useState<ScenarioCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScenarioMultipliers | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await compareScenarios(planId);
      setCompare(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runCalc = async (scenarioId: string, jobId?: string | null) => {
    setBusy(scenarioId);
    try {
      let jid = jobId;
      if (!jid) {
        const job = await calculateScenario(planId, scenarioId);
        jid = job.id;
      }
      const result = await pollScenarioJob(jid!);
      if (result.status === "FAILED") throw new Error(result.error || "Calcul échoué");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur calcul");
    } finally {
      setBusy(null);
    }
  };

  const runAll = async () => {
    setBusy("all");
    try {
      const jobs = await calculateAllScenarios(planId);
      for (const j of jobs) {
        await pollScenarioJob(j.id);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (s: PlanScenario) => {
    setEditingId(s.id);
    setDraft({ ...s.multipliers });
  };

  const saveEdit = async () => {
    if (!editingId || !draft) return;
    setBusy(editingId);
    try {
      await updateScenario(planId, editingId, { multipliers: draft, recalculate: true });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const addCustom = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy("new");
    try {
      await createScenario(planId, name);
      setNewName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const recommend = async (scenarioId: string) => {
    setBusy(`official-${scenarioId}`);
    try {
      await setOfficialScenario(planId, scenarioId);
      await load();
      onOfficialSet?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-navy-500">Chargement des scénarios…</p>;
  }

  const labels: Record<string, string> = {};
  compare?.scenarios.forEach((s) => {
    const key = s.slug ?? s.id;
    labels[key] = s.name;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-navy-900">Scénarios</h3>
          <p className="text-sm text-navy-600">
            Pessimiste, base et optimiste — projections 7 ans et comparaison des indicateurs.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runAll()}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Calculer tous les scénarios
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Nom du scénario personnalisé"
            className="rounded-lg border border-navy-200 px-3 py-2 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void addCustom()}
            className="inline-flex items-center gap-1 rounded-lg border border-navy-200 px-3 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-navy-100">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead className="bg-navy-50 text-xs font-semibold uppercase text-navy-600">
            <tr>
              <th className="px-3 py-2">Scénario</th>
              <th className="px-3 py-2">VAN</th>
              <th className="px-3 py-2">TRI</th>
              <th className="px-3 py-2">DRCI</th>
              <th className="px-3 py-2">Point mort</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {compare?.kpi_table.map((row) => {
              const slug = row.slug ?? "";
              const color = slug === "pessimiste" ? "text-red-600" : slug === "optimiste" ? "text-emerald-700" : "text-navy-700";
              return (
                <tr key={row.id} className={`border-t border-navy-100 ${row.is_official ? "bg-gold-50/50" : ""}`}>
                  <td className={`px-3 py-2 font-medium ${color}`}>
                    {row.name}
                    {row.is_official && (
                      <span className="ms-2 rounded-full bg-gold-200 px-2 py-0.5 text-[10px] text-navy-800">
                        Officiel
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmt(row.van)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(row.tri)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.drci != null ? `${row.drci} ans` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.point_mort != null ? `An ${row.point_mort}` : "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.status}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-xs text-navy-600 hover:underline"
                          onClick={() => {
                            const s = compare?.scenarios.find((x) => x.id === row.id);
                            if (s) startEdit(s);
                          }}
                        >
                          Modifier
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          className="text-xs text-gold-700 hover:underline"
                          onClick={() => void runCalc(row.id)}
                        >
                          Calculer
                        </button>
                      )}
                      <RoleGate role={["expert", "admin"]}>
                        {row.status === "COMPLETED" && (
                          <button
                            type="button"
                            disabled={busy !== null || row.is_official}
                            title="Recommander pour la liasse officielle"
                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-violet-700 hover:underline disabled:opacity-40"
                            onClick={() => void recommend(row.id)}
                          >
                            {busy === `official-${row.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Star className="h-3 w-3" />
                            )}
                            Recommander
                          </button>
                        )}
                      </RoleGate>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-navy-100 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold text-navy-800">Résultat net — comparaison 7 ans</h4>
        <ScenarioComparisonChart
          series={compare?.net_profit_series ?? {}}
          labels={labels}
        />
      </div>

      {editingId && draft && (
        <div className="rounded-xl border border-gold-200 bg-gold-50/30 p-4">
          <h4 className="mb-3 text-sm font-semibold text-navy-800">Hypothèses du scénario</h4>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-navy-600">
              Croissance masse salariale (annuelle)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={draft.personnel_cost_growth}
                onChange={(e) =>
                  setDraft({ ...draft, personnel_cost_growth: parseFloat(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-xs text-navy-600">
              Ratio coût matières
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={draft.raw_material_cost_ratio}
                onChange={(e) =>
                  setDraft({ ...draft, raw_material_cost_ratio: parseFloat(e.target.value) || 1 })
                }
              />
            </label>
            <label className="text-xs text-navy-600">
              Mult. taux emprunt
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={draft.loan_interest_rate_mult}
                onChange={(e) =>
                  setDraft({ ...draft, loan_interest_rate_mult: parseFloat(e.target.value) || 1 })
                }
              />
            </label>
            <label className="text-xs text-navy-600">
              Échelle CA (prix)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={draft.revenue_scale}
                onChange={(e) =>
                  setDraft({ ...draft, revenue_scale: parseFloat(e.target.value) || 1 })
                }
              />
            </label>
          </div>
          <p className="mb-2 text-xs font-medium text-navy-700">Croissance CA par année (% décimal)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {YEAR_LABELS.map((lbl, i) => (
              <label key={lbl} className="text-center text-[10px] text-navy-500">
                {lbl}
                <input
                  type="number"
                  step="0.005"
                  className="mt-0.5 w-full rounded border px-1 py-1 text-xs"
                  value={draft.revenue_growth_by_year[i] ?? 0.03}
                  onChange={(e) => {
                    const next = [...draft.revenue_growth_by_year];
                    next[i] = parseFloat(e.target.value) || 0;
                    setDraft({ ...draft, revenue_growth_by_year: next });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={busy !== null}
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900"
            >
              Enregistrer et recalculer
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg border px-4 py-2 text-sm text-navy-600"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
