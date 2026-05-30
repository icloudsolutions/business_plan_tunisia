"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileBarChart } from "lucide-react";
import { downloadCompletenessReport } from "@/lib/completion";
import { usePlanCompletion } from "@/hooks/usePlanCompletion";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import AuthGuard from "@/components/AuthGuard";
import CollaborationSidebar from "@/components/collaboration/CollaborationSidebar";
import PresenceBridge from "@/components/collaboration/PresenceBridge";
import PlanOverviewCard from "@/components/dashboard/PlanOverviewCard";
import { CollaborationProvider } from "@/context/CollaborationContext";
import { useDashboardNav } from "@/context/DashboardNavContext";
import LiasseWizard from "@/components/liasse-wizard/LiasseWizard";
import ScenarioManager from "@/components/scenarios/ScenarioManager";
import ResultsPanel from "@/components/ResultsPanel";
import SimulationPanel from "@/components/SimulationPanel";
import FinancialAuditPanel from "@/components/FinancialAuditPanel";
import { useAuth } from "@/context/AuthContext";
import {
  auditPlan,
  downloadExport,
  exportPlan,
  getPlan,
  listSimulations,
  pollJob,
  recalculate,
  runSimulation,
  saveInputs,
  submitPlan,
  transitionPlan,
  type AuditResult,
  type Plan,
  type SimulationItem,
} from "@/lib/api";

function PlanContent() {
  const params = useParams();
  const id = params.id as string;
  const tPlan = useTranslations("plan");
  const { isExpert } = useAuth();
  const { setPlanTitle, setPlanId, setPlanCompletion, setRefreshPlan } = useDashboardNav();
  const [completionKey, setCompletionKey] = useState(0);
  const { completion } = usePlanCompletion(id, completionKey);
  const jumpToFieldRef = useRef<((step: WizardStepId, path: string) => void) | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [simulations, setSimulations] = useState<SimulationItem[]>([]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "recalc" | "simulate">("");
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>("_global");

  const load = useCallback(async () => {
    setError("");
    try {
      const p = await getPlan(id);
      setPlan(p);
      setPlanTitle(p.title);
      setInputs(p.inputs || {});
      const sims = await listSimulations(id);
      setSimulations(sims);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setPlanId(id);
    load();
    return () => {
      setPlanTitle(null);
      setPlanId(null);
      setPlanCompletion(null);
      setRefreshPlan(null);
    };
  }, [id, load, setPlanTitle, setPlanId, setPlanCompletion, setRefreshPlan]);

  useEffect(() => {
    setRefreshPlan(() => () => {
      void load();
    });
  }, [load, setRefreshPlan]);

  useEffect(() => {
    setPlanCompletion(completion);
  }, [completion, setPlanCompletion]);

  const readOnly =
    plan?.status === "VALIDATED" ||
    (plan?.status === "UNDER_REVIEW" && !isExpert);

  const collabEnabled =
    plan?.status === "UNDER_REVIEW" || plan?.status === "ADJUSTMENT";

  const handleRecalc = async () => {
    if (busyAction) return;
    setError("");
    setBusyAction("recalc");
    try {
      const job = await recalculate(id);
      setJobStatus("PENDING");
      const result = await pollJob(job.id, setJobStatus);
      if (result.status === "FAILED") setError(result.error || tPlan("calcFailed"));
      else await load();
    } finally {
      setBusyAction("");
      setJobStatus("");
    }
  };

  const handleSimulate = async () => {
    if (busyAction) return;
    setError("");
    setBusyAction("simulate");
    try {
      const job = await runSimulation(
        id,
        [{ path: "operations/rawMaterialCost", multiplier: 1.15 }],
        "Inflation matières +15%"
      );
      setJobStatus("PENDING");
      const result = await pollJob(job.id, setJobStatus);
      if (result.status === "FAILED") setError(result.error || tPlan("simFailed"));
      else await load();
    } finally {
      setBusyAction("");
      setJobStatus("");
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-hidden />
        <p>{tPlan("loading")}</p>
      </div>
    );
  }

  if (!plan) {
    return <p className="form-error">{error || tPlan("notFound")}</p>;
  }

  const main = (
    <>
      <div className="mb-8">
        <PlanOverviewCard
          plan={plan}
          completion={completion}
          createdAt={plan.created_at}
          onRefresh={load}
          onJumpToField={(step, path) => jumpToFieldRef.current?.(step, path)}
        />
      </div>

      <div className="card mb-6 !overflow-visible">
        <ScenarioManager
          planId={id}
          readOnly={readOnly}
          onOfficialSet={load}
        />
      </div>

      <div className="card mb-8">
        <ResultsPanel results={plan.results as never} />
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-navy-800">
          {tPlan("liasseTitle")}
        </h2>
        {isExpert && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-700 hover:border-gold-400"
            onClick={() => void downloadCompletenessReport(id)}
          >
            <FileBarChart className="h-4 w-4" />
            {tPlan("completenessReport")}
          </button>
        )}
      </div>
      <p className="mb-6 text-sm text-navy-600">
        {tPlan("wizardIntro", { steps: 13 })}
        {collabEnabled ? ` ${tPlan("collabActive")}` : ""}
      </p>

      {error && <p className="form-error">{error}</p>}
      {jobStatus && (
        <p className="alert alert-info">{tPlan("processing", { status: jobStatus })}</p>
      )}

      <div
        className={
          collabEnabled
            ? "flex flex-col gap-6 xl:flex-row xl:items-start"
            : ""
        }
      >
        <div className={collabEnabled ? "min-w-0 flex-1 space-y-6" : "space-y-6"}>
          <div className="card !overflow-visible !p-0 sm:!p-0">
            <LiasseWizard
              planId={id}
              inputs={inputs}
              onChange={setInputs}
              missingFields={missingFields}
              completion={completion}
              onRegisterNavigator={(fn) => {
                jumpToFieldRef.current = fn;
              }}
              onSave={async (inp) => {
                const res = await saveInputs(id, inp);
                setPlan(res.plan);
                setMissingFields(res.missingFields || []);
                setCompletionKey((k) => k + 1);
              }}
              onPlanModuleChange={() => setCompletionKey((k) => k + 1)}
              readOnly={readOnly}
            />
          </div>

          {collabEnabled && (
            <div className="card">
              <h3 className="card-title">{tPlan("simulationsCompare")}</h3>
              <SimulationPanel simulations={simulations} />
            </div>
          )}
        </div>

        {collabEnabled && (
          <CollaborationSidebar
            planId={id}
            planStatus={plan.status}
            onPlanUpdated={load}
          />
        )}
      </div>

      <div className="plan-actions btn-group">
        {!isExpert && plan.status === "DRAFT" && (
          <>
            <button type="button" className="btn btn-primary" onClick={handleRecalc}>
              {tPlan("calc7y")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                await submitPlan(id);
                load();
              }}
            >
              {tPlan("submitExpert")}
            </button>
          </>
        )}
        {(plan.status === "UNDER_REVIEW" || plan.status === "ADJUSTMENT") && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRecalc}
              disabled={!!busyAction}
            >
              {busyAction === "recalc" ? `${tPlan("recalc")}…` : tPlan("recalc")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSimulate}
              disabled={!!busyAction}
            >
              {busyAction === "simulate" ? "…" : tPlan("simulate")}
            </button>
            {isExpert && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => setAudit(await auditPlan(id))}
                >
                  {tPlan("financialAudit")}
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={async () => {
                    await transitionPlan(id, "VALIDATE");
                    load();
                  }}
                >
                  {tPlan("validate")}
                </button>
              </>
            )}
          </>
        )}
        {plan.status === "VALIDATED" && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                setError("");
                setExportFormats([]);
                const job = await exportPlan(id);
                setExportJobId(job.id);
                try {
                  const result = await pollJob(job.id, setJobStatus);
                  setExportJobId(job.id);
                  const formats = result.result?.formats ?? Object.keys(result.result?.files ?? {});
                  setExportFormats(formats.length ? formats : ["pdf", "xlsx"]);
                } catch (e) {
                  setError(e instanceof Error ? e.message : tPlan("exportFailed"));
                  setExportJobId(null);
                }
              }}
            >
              {tPlan("exportGenerate")}
            </button>
            {exportJobId && exportFormats.length > 0 && (
              <>
                {exportFormats.includes("pdf") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadExport(id, exportJobId, "pdf")}
                  >
                    {tPlan("exportPdf")}
                  </button>
                )}
                {exportFormats.includes("xlsx") && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadExport(id, exportJobId, "xlsx")}
                  >
                    {tPlan("exportXlsx")}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {audit && (
        <FinancialAuditPanel audit={audit} onClose={() => setAudit(null)} />
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {collabEnabled ? (
        <CollaborationProvider
          planId={id}
          enabled
          activeFieldKey={activeFieldKey}
          setActiveFieldKey={setActiveFieldKey}
        >
          <PresenceBridge />
          {main}
        </CollaborationProvider>
      ) : (
        main
      )}
    </div>
  );
}

export default function PlanPage() {
  return (
    <AuthGuard>
      <PlanContent />
    </AuthGuard>
  );
}
