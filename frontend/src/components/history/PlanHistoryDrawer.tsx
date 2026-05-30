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
import { useTranslations } from "next-intl";
import RoleGate from "@/components/auth/RoleGate";
import { useAuth } from "@/context/AuthContext";
import { useDashboardNav } from "@/context/DashboardNavContext";
import StatusBadge from "@/components/StatusBadge";
import PlanAuditLogPanel from "@/components/history/PlanAuditLogPanel";
import PlanExportHistory from "@/components/history/PlanExportHistory";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { FOCUS_RING } from "@/lib/a11y";
import { cn } from "@/lib/utils";
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

type Tab = "versions" | "exports" | "audit";

export default function PlanHistoryDrawer() {
  const t = useTranslations("history");
  const { user } = useAuth();
  const { planId, planTitle, historyOpen, setHistoryOpen, refreshPlan } = useDashboardNav();

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
        aria-label={t("close")}
        onClick={() => setHistoryOpen(false)}
      />
      <aside
        className="fixed inset-y-0 end-0 z-[61] flex w-full max-w-md flex-col overflow-hidden border-s border-navy-100 bg-white shadow-2xl"
        role="dialog"
        aria-labelledby="plan-history-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-navy-100 px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-navy-800">
              <Clock className="h-5 w-5 shrink-0 text-gold-600" />
              <h2 id="plan-history-title" className="font-display text-lg font-semibold">
                {t("title")}
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
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

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
            {t("versions")}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("exports");
              setDiff(null);
            }}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === "exports"
                ? "border-gold-500 text-navy-800"
                : "border-transparent text-navy-500 hover:text-navy-700"
            }`}
          >
            {t("exports")}
          </button>
          <RoleGate role={["expert", "admin"]}>
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
              {t("auditLog")}
            </button>
          </RoleGate>
        </div>

        {error && (
          <p className="shrink-0 px-4 py-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === "exports" ? (
            <PlanExportHistory planId={planId} active={historyOpen && tab === "exports"} />
          ) : tab === "audit" ? (
            <RoleGate role={["expert", "admin"]}>
              <PlanAuditLogPanel planId={planId} active={historyOpen && tab === "audit"} />
            </RoleGate>
          ) : diffLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-navy-600">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {t("loading")}
            </div>
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
                  className="btn btn-primary flex w-full gap-2 !py-2.5 text-sm"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  {t("createSnapshot")}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-navy-600">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    {t("loading")}
                  </div>
                ) : versions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-navy-500">{t("noVersions")}</p>
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
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              disabled={diffLoading}
                              onClick={() => void handleCompare(v)}
                              className="btn btn-secondary w-full justify-center !py-2 text-xs sm:w-auto"
                            >
                              <GitCompare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {t("compare")}
                            </button>
                            <RoleGate role={["expert", "admin"]}>
                              <button
                                type="button"
                                onClick={() => setRestoreTarget(v)}
                                className="btn btn-secondary w-full justify-center !py-2 text-xs sm:w-auto"
                              >
                                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {t("restore")}
                              </button>
                            </RoleGate>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>

        <Dialog
          open={!!restoreTarget}
          onOpenChange={(open) => !open && setRestoreTarget(null)}
        >
          <DialogContent
            className="max-w-sm p-0"
            showClose={false}
            aria-labelledby="restore-title"
            aria-describedby="restore-desc"
          >
            <DialogHeader>
              <h3
                id="restore-title"
                className="font-display text-base font-semibold text-navy-800"
              >
                {restoreTarget &&
                  t("restoreTitle", { n: restoreTarget.version_number })}
              </h3>
              <p id="restore-desc" className="text-sm text-navy-600">
                {restoreTarget &&
                  t("restoreBody", {
                    reason: restoreTarget.reason_label || restoreTarget.reason,
                  })}
              </p>
              <p className="text-xs text-navy-600">
                {t("connectedAs", { email: user?.email ?? "—" })}
              </p>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={cn("btn btn-secondary w-full sm:w-auto", FOCUS_RING)}
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className={cn(
                  "btn w-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 sm:w-auto",
                  FOCUS_RING
                )}
                onClick={() => void handleRestore()}
                disabled={restoring}
              >
                {restoring ? t("restoring") : t("confirmRestore")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    </>
  );
}
