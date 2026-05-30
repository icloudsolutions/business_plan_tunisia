"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronRight,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { downloadExport, exportPlan } from "@/lib/api";
import {
  fetchProjections,
  pollCalcJob,
  pollExportJob,
  simulateProjections,
  type ProjectionPayload,
  type ScenarioKey,
} from "@/lib/finance/projections-api";
import ChartSkeleton from "./ChartSkeleton";
import KpiCards from "./KpiCards";
import ResultsTab from "./tabs/ResultsTab";
import TreasuryTab from "./tabs/TreasuryTab";
import InvestmentsTab from "./tabs/InvestmentsTab";

type TabId = "results" | "treasury" | "investments" | "kpis";

const TABS: { id: TabId; label: string }[] = [
  { id: "results", label: "Résultats" },
  { id: "treasury", label: "Trésorerie" },
  { id: "investments", label: "Investissements" },
  { id: "kpis", label: "Indicateurs clés" },
];

const SCENARIOS: { id: ScenarioKey; label: string }[] = [
  { id: "pessimistic", label: "Pessimiste" },
  { id: "base", label: "Base" },
  { id: "optimistic", label: "Optimiste" },
];

type Props = {
  planId: string;
};

export default function FinanceLiveDashboard({ planId }: Props) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<TabId>("results");
  const [scenario, setScenario] = useState<ScenarioKey>("base");
  const [loading, setLoading] = useState(true);
  const [calcStatus, setCalcStatus] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [error, setError] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planStatus, setPlanStatus] = useState("");
  const [scenarios, setScenarios] = useState<Record<string, ProjectionPayload> | null>(
    null
  );

  const [revMult, setRevMult] = useState(1);
  const [growthMult, setGrowthMult] = useState(1);
  const [loanMult, setLoanMult] = useState(1);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetchProjections(planId, {
        scenario: "all",
        revenueMult: scenario === "custom" ? revMult : undefined,
        growthMult: scenario === "custom" ? growthMult : undefined,
        loanRateMult: scenario === "custom" ? loanMult : undefined,
      });
      setPlanTitle(res.plan_title);
      setPlanStatus(res.plan_status);
      if (res.scenarios) {
        setScenarios(res.scenarios);
      } else if (res.active) {
        setScenarios({ base: res.active });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, [planId, scenario, revMult, growthMult, loanMult]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = scenarios?.[scenario] ?? scenarios?.base ?? null;
  const overlay = useMemo(() => {
    if (!scenarios) return null;
    if (scenario === "base") return scenarios.pessimistic ?? null;
    if (scenario === "optimistic") return scenarios.pessimistic ?? null;
    return scenarios.optimistic ?? null;
  }, [scenarios, scenario]);
  const overlayLabel = scenario === "optimistic" ? "Pessimiste" : "Optimiste";

  const handleSimulate = async () => {
    setError("");
    setCalcStatus("PENDING");
    try {
      const job = await simulateProjections(planId, {
        revenue_year1_mult: revMult,
        growth_mult: growthMult,
        loan_rate_mult: loanMult,
        persist: true,
      });
      await pollCalcJob(job.id, setCalcStatus);
      setScenario("custom");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation échouée");
    } finally {
      setCalcStatus("");
    }
  };

  const handleExport = async (format: "pdf" | "xlsx") => {
    setError("");
    setExportStatus("PENDING");
    try {
      const job = await exportPlan(planId);
      const result = await pollExportJob(planId, job.id, setExportStatus, 3000);
      if (result.formats.includes(format)) {
        await downloadExport(planId, job.id, format);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setExportStatus("");
    }
  };

  const showOverlay = scenario !== "pessimistic" && overlay != null && scenario !== "custom";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/finance" className="text-sm text-slate-500 hover:text-brand-600">
            Cockpit
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">{planTitle || "…"}</h1>
            <p className="text-xs text-slate-500">{planStatus}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            title="Actualiser"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href={`/plans/${planId}`}
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
          >
            <BarChart3 className="mr-1.5 inline h-4 w-4" />
            Liasse
          </Link>
          <button type="button" onClick={logout} className="rounded-lg p-2 text-slate-500">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Scénario</span>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                scenario === s.id
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
          {scenario === "custom" && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              Simulation personnalisée
            </span>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-800">Simulation interactive</h3>
            <p className="mb-4 text-xs text-slate-500">
              Ajustez les hypothèses puis lancez un recalcul Celery (7 ans).
            </p>
            <div className="space-y-4">
              <label className="block text-xs text-slate-600">
                CA année 1 — multiplicateur : {(revMult * 100).toFixed(0)} %
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  value={revMult}
                  onChange={(e) => setRevMult(parseFloat(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
              <label className="block text-xs text-slate-600">
                Croissance CA — multiplicateur : {(growthMult * 100).toFixed(0)} %
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  value={growthMult}
                  onChange={(e) => setGrowthMult(parseFloat(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
              <label className="block text-xs text-slate-600">
                Taux emprunt — multiplicateur : {(loanMult * 100).toFixed(0)} %
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  value={loanMult}
                  onChange={(e) => setLoanMult(parseFloat(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!!calcStatus}
              onClick={() => void handleSimulate()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {calcStatus ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {calcStatus}
                </>
              ) : (
                "Recalculer la projection"
              )}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Exports</h3>
            <p className="mb-3 text-xs text-slate-500">
              Plan validé requis pour l&apos;export officiel. Polling toutes les 3 s.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!!exportStatus}
                onClick={() => void handleExport("xlsx")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Télécharger Excel
              </button>
              <button
                type="button"
                disabled={!!exportStatus}
                onClick={() => void handleExport("pdf")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Télécharger PDF
              </button>
              {exportStatus && (
                <p className="text-center text-xs text-brand-600">{exportStatus}</p>
              )}
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {loading || calcStatus ? (
          <ChartSkeleton height={320} />
        ) : !active ? (
          <p className="text-sm text-slate-600">
            Aucune projection — lancez un calcul depuis la liasse ou la simulation ci-dessus.
          </p>
        ) : (
          <>
            {tab === "results" && (
              <ResultsTab
                base={active}
                overlay={showOverlay ? overlay : null}
                overlayLabel={showOverlay ? overlayLabel : undefined}
              />
            )}
            {tab === "treasury" && <TreasuryTab data={active} />}
            {tab === "investments" && <InvestmentsTab data={active} />}
            {tab === "kpis" && <KpiCards data={active} />}
          </>
        )}

        <p className="text-center text-xs text-slate-400">
          Connecté : {user?.email} · Données bp_calc (7 ans)
        </p>
      </main>
    </div>
  );
}
