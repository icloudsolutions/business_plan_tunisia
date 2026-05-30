"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  GitCompare,
  Loader2,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardNav } from "@/context/DashboardNavContext";
import StatusBadge from "@/components/StatusBadge";
import PlanAuditLogPanel from "@/components/history/PlanAuditLogPanel";
import VersionDiffView from "@/components/history/VersionDiffView";
import {
  createPlanSnapshot,
  diffPlanVersion,
  listPlanVersions,
  restorePlanVersion,
  type PlanVersionSummary,
  type PlanVersionDiff,
} from "@/lib/history-api";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-TN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type Tab = "versions" | "audit";

export default function PlanHistoryDrawer() {
  const { isExpert, isAdmin, user } = useAuth();
  const { planId, planTitle, historyOpen, setHistoryOpen, refreshPlan } = useDashboardNav();
  const canRestore = isExpert || isAdmin;
  const showAuditTab = isExpert || isAdmin;

  const [tab, setTab] = useState<Tab>("versions");
  const [versions, setVersions] = useState<PlanVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [diff, setDiff] = useState<PlanVersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<PlanVersionSummary | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError("");
    try {
      setVersions(await listPlanVersions(planId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (historyOpen && planId) {
      setDiff(null);
      setRestoreTarget(null);
      void loadVersions();
    }
  }, [historyOpen, planId, loadVersions]);

  useEffect(() => {
    if (!historyOpen) {
      setTab("versions");
      setDiff(null);
      setRestoreTarget(null);
    }
  }, [historyOpen]);

  if (!historyOpen || !planId) return null;

  const handleSnapshot = async () => {
    setSaving(true);
    setError("");
    try {
      await createPlanSnapshot(planId);
      await loadVersions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleCompare = async (v: PlanVersionSummary) => {
    setDiffLoading(true);
    setError("");
    try {
      setDiff(await diffPlanVersion(planId, v.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setError("");
    try {
      await restorePlanVersion(planId, restoreTarget.id);
      setRestoreTarget(null);
      setDiff(null);
      await loadVersions();
      refreshPlan?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-navy-900/40 backdrop-blur-[2px]"
        aria-label="Fermer l'historique"
        onClick={() => setHistoryOpen(false)}
      />
      <aside
        className="fixed inset-y-0 end-0 z-[61] flex w-full max-w-md flex-col border-s border-navy-100 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="plan-history-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-navy-100 px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-navy-800">
              <Clock className="h-5 w-5 shrink-0 text-gold-600" />
              <h2 id="plan-history-title" className="font-display text-lg font-semibold">
                Historique
              </h2>
            </div>
            {planTitle && (
              <p className="mt-0.5 truncate text-sm text-navy-600">{planTitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            className="rounded-lg border border-navy-100 p-2 text-navy-600 hover:bg-navy-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {showAuditTab && (
          <div className="flex shrink-0 border-b border-navy-100 px-4">
            <button
              type="button"
              onClick={() => {
                setTab("versions");
                setDiff(null);
              }}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === "versions"
                  ? "border-gold-500 text-navy-800"
                  : "border-transparent text-navy-500 hover:text-navy-700"
              }`}
            >
              Versions
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("audit");
                setDiff(null);
              }}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === "audit"
                  ? "border-gold-500 text-navy-800"
                  : "border-transparent text-navy-500 hover:text-navy-700"
              }`}
            >
              Historique des modifications
            </button>
          </div>
        )}

        {error && (
          <p className="shrink-0 px-4 py-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        {tab === "audit" && showAuditTab ? (
          <PlanAuditLogPanel planId={planId} active={historyOpen && tab === "audit"} />
        ) : diff ? (
          <VersionDiffView
            changes={diff.changes}
            versionNumber={diff.version_number}
            onBack={() => setDiff(null)}
          />
        ) : (
          <>
            <div className="shrink-0 px-4 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSnapshot()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold-300 bg-gold-50 px-3 py-2.5 text-sm font-semibold text-navy-800 transition hover:bg-gold-100 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Créer un point de sauvegarde
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-navy-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Chargement…
                </div>
              ) : versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-navy-500">
                  Aucune version enregistrée. Les transitions de statut et les soumissions
                  créent automatiquement des points de restauration.
                </p>
              ) : (
                <ol className="relative space-y-0 border-s-2 border-navy-100 ps-4">
                  {versions.map((v, i) => (
                    <li key={v.id} className="relative pb-6 last:pb-2">
                      <span
                        className={`absolute -start-[1.35rem] top-1 flex h-3 w-3 rounded-full ring-4 ring-white ${
                          i === 0 ? "bg-gold-500" : "bg-navy-300"
                        }`}
                      />
                      <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-navy-800">
                            v{v.version_number}
                          </span>
                          <StatusBadge status={v.status_at_snapshot} />
                        </div>
                        <p className="text-sm font-medium text-navy-800">
                          {v.reason_label || v.reason}
                        </p>
                        <p className="mt-1 text-[11px] text-navy-500">
                          {v.created_by_email ?? "—"} · {formatTime(v.created_at)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={diffLoading}
                            onClick={() => void handleCompare(v)}
                            className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-700 hover:border-gold-400"
                          >
                            <GitCompare className="h-3.5 w-3.5" />
                            Comparer avec la version actuelle
                          </button>
                          {canRestore && (
                            <button
                              type="button"
                              onClick={() => setRestoreTarget(v)}
                              className="inline-flex items-center gap-1 rounded-md border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-700 hover:border-amber-400"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restaurer cette version
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}

        {restoreTarget && (
          <div className="absolute inset-0 z-10 flex items-end justify-center bg-navy-900/50 p-4 sm:items-center">
            <div
              className="w-full max-w-sm rounded-xl border border-navy-100 bg-white p-5 shadow-xl"
              role="alertdialog"
              aria-labelledby="restore-title"
            >
              <h3 id="restore-title" className="font-display text-base font-semibold text-navy-800">
                Restaurer la version {restoreTarget.version_number} ?
              </h3>
              <p className="mt-2 text-sm text-navy-600">
                Les données actuelles du plan seront remplacées par le contenu de cette
                sauvegarde ({restoreTarget.reason_label || restoreTarget.reason}). Cette action
                est réservée aux experts et administrateurs.
              </p>
              <p className="mt-2 text-xs text-navy-500">
                Connecté : {user?.email}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-700 hover:bg-navy-50"
                  onClick={() => setRestoreTarget(null)}
                  disabled={restoring}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  onClick={() => void handleRestore()}
                  disabled={restoring}
                >
                  {restoring ? "Restauration…" : "Confirmer la restauration"}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
