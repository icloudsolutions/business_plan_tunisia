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
import { useTranslations } from "next-intl";
import LanguageToggle from "@/components/LanguageToggle";
import { useAuth } from "@/context/AuthContext";
import { downloadExport } from "@/lib/api";
import { useExportJobs } from "@/context/ExportJobsContext";
import {
  fetchProjections,
  pollCalcJob,
  simulateProjections,
  type ProjectionPayload,
  type ScenarioKey,
} from "@/lib/finance/projections-api";
import ChartSkeleton from "./ChartSkeleton";
import KpiDashboard from "./KpiDashboard";
import ResultsTab from "./tabs/ResultsTab";
import TreasuryTab from "./tabs/TreasuryTab";
import InvestmentsTab from "./tabs/InvestmentsTab";
import BalanceSheetTab from "./tabs/BalanceSheetTab";
import InventoryTab from "./tabs/InventoryTab";

type TabId = "results" | "treasury" | "investments" | "balance" | "kpis" | "inventory";

type Props = {
  planId: string;
};

export default function FinanceLiveDashboard({ planId }: Props) {
  const tFinance = useTranslations("finance");
  const tCommon = useTranslations("common");
  const { user, logout } = useAuth();

  const TABS: { id: TabId; label: string }[] = [
    { id: "kpis", label: tFinance("tabSummary") },
    { id: "inventory", label: tFinance("tabInventory") },
    { id: "results", label: tFinance("tabResults") },
    { id: "treasury", label: tFinance("tabTreasury") },
    { id: "investments", label: tFinance("tabInvestments") },
    { id: "balance", label: tFinance("tabBalance") },
  ];

  const SCENARIOS: { id: ScenarioKey; label: string }[] = [
    { id: "pessimistic", label: tFinance("scenarioPessimistic") },
    { id: "base", label: tFinance("scenarioBase") },
    { id: "optimistic", label: tFinance("scenarioOptimistic") },
  ];
  const [tab, setTab] = useState<TabId>("kpis");
  const [scenario, setScenario] = useState<ScenarioKey>("base");
  const [loading, setLoading] = useState(true);
  const [calcStatus, setCalcStatus] = useState("");
  const { startExport } = useExportJobs();
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
  const presetScenario =
    scenario === "custom" ? "base" : scenario;
  const overlay = useMemo(() => {
    if (!scenarios) return null;
    if (scenario === "base") return scenarios.pessimistic ?? null;
    if (scenario === "optimistic") return scenarios.pessimistic ?? null;
    return scenarios.optimistic ?? null;
  }, [scenarios, scenario]);
  const overlayLabel =
    scenario === "optimistic"
      ? tFinance("scenarioPessimistic")
      : tFinance("scenarioOptimistic");

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
      setError(e instanceof Error ? e.message : tFinance("simulateStress"));
    } finally {
      setCalcStatus("");
    }
  };

  const handleExport = async (format: "pdf" | "xlsx") => {
    setError("");
    try {
      await startExport(planId, format, { planTitle: planTitle ?? undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible");
    }
  };

  const showOverlay = scenario !== "pessimistic" && overlay != null && scenario !== "custom";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:h-16 sm:flex-nowrap sm:gap-4 sm:px-6">
          <Link
            href="/finance"
            prefetch={false}
            className="shrink-0 text-xs text-slate-500 hover:text-brand-600 sm:text-sm"
          >
            {tFinance("cockpitNav")}
          </Link>
          <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <h1 className="truncate font-display text-base font-semibold sm:text-lg">
              {planTitle || "…"}
            </h1>
            <p className="truncate text-xs text-slate-500">{planStatus}</p>
          </div>
          <LanguageToggle />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            aria-label={tCommon("refresh")}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
          <Link
            href={`/plans/${planId}`}
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
          >
            <BarChart3 className="me-1.5 inline h-4 w-4" />
            {tFinance("liasseLink")}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-2 text-slate-600"
            aria-label={tCommon("logout")}
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          <span className="shrink-0 text-xs font-semibold uppercase text-slate-500">
            Scénario
          </span>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-4 ${
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                tFinance("recalcProjection")
              )}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800">Exports</h3>
            <p className="mb-3 text-xs text-slate-500">
              Plan validé requis pour l&apos;export officiel. Suivi dans la notification
              en bas à droite.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleExport("xlsx")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Télécharger Excel
              </button>
              <button
                type="button"
                onClick={() => void handleExport("pdf")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Télécharger PDF
              </button>
            </div>
          </div>
        </div>

        <nav
          className="-mx-1 flex gap-0.5 overflow-x-auto border-b border-slate-200 px-1 pb-px scrollbar-thin"
          role="tablist"
        >
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              role="tab"
              aria-selected={tab === tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                tab === tabItem.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </nav>

        {tab === "kpis" ? (
          <KpiDashboard planId={planId} scenario={presetScenario} />
        ) : tab === "balance" ? (
          <BalanceSheetTab planId={planId} scenario={presetScenario} />
        ) : tab === "treasury" ? (
          <TreasuryTab planId={planId} scenario={presetScenario} />
        ) : tab === "inventory" && active ? (
          <InventoryTab data={active} />
        ) : loading || calcStatus ? (
          <ChartSkeleton height={320} />
        ) : !active ? (
          <p className="text-sm text-slate-600">
            {tFinance("noProjection")}
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
            {tab === "investments" && <InvestmentsTab data={active} />}
          </>
        )}

        <p className="text-center text-xs text-slate-400">
          Connecté : {user?.email} · Données bp_calc (7 ans)
        </p>
      </main>
    </div>
  );
}
