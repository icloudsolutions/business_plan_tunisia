"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileBarChart } from "lucide-react";
import SubmitBlockedModal from "@/components/completion/SubmitBlockedModal";
import {
  downloadCompletenessReport,
  type CompletionFieldItem,
} from "@/lib/completion";
import { isApiHttpError, parseMissingFieldsFromApiError } from "@/lib/api-errors";
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
import PlanActionBar, { type PlanActionBusy } from "@/components/plan/PlanActionBar";
import RoleGate from "@/components/auth/RoleGate";
import { useAuth } from "@/context/AuthContext";
import { userHasRole } from "@/lib/auth-roles";
import {
  downloadExport,
  getPlan,
  listSimulations,
  resubmitPlan,
  saveInputs,
  submitPlan,
  transitionPlan,
  type AuditResult,
  type Plan,
  type SimulationItem,
} from "@/lib/api";
import { useExportJobs } from "@/context/ExportJobsContext";

function PlanContent() {
  const params = useParams();
  const id = params.id as string;
  const tPlan = useTranslations("plan");
  const { user } = useAuth();
  const { setPlanTitle, setPlanId, setPlanCompletion, setRefreshPlan } = useDashboardNav();
  const [completionKey, setCompletionKey] = useState(0);
  const bumpCompletion = useCallback(() => {
    setCompletionKey((k) => k + 1);
  }, []);
  const { completion } = usePlanCompletion(id, completionKey);
  const jumpToFieldRef = useRef<((step: WizardStepId, path: string) => void) | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [simulations, setSimulations] = useState<SimulationItem[]>([]);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [busyAction, setBusyAction] = useState<PlanActionBusy>("");
  const { startExport } = useExportJobs();
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitBlockedOpen, setSubmitBlockedOpen] = useState(false);
  const [submitBlockedPaths, setSubmitBlockedPaths] = useState<string[]>([]);
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

  const refreshPlanRef = useRef(load);
  refreshPlanRef.current = load;

  useEffect(() => {
    setRefreshPlan(() => () => {
      void refreshPlanRef.current();
    });
    return () => setRefreshPlan(null);
  }, [setRefreshPlan]);

  useEffect(() => {
    setPlanCompletion(completion);
  }, [completion, setPlanCompletion]);

  const canEditUnderReview = userHasRole(user?.role, ["expert", "admin"]);
  const readOnly =
    plan?.status === "VALIDATED" ||
    (plan?.status === "UNDER_REVIEW" && !canEditUnderReview);

  const collabEnabled =
    plan?.status === "UNDER_REVIEW" || plan?.status === "ADJUSTMENT";

  const submitBlockedItems: CompletionFieldItem[] = (() => {
    if (!completion) {
      return submitBlockedPaths.map((path) => ({
        path,
        section: "",
        tier: "required",
        label_fr: path,
        label_ar: path,
        filled: false,
      }));
    }
    const byPath = new Map(
      completion.required_missing.map((item) => [item.path, item])
    );
    const paths =
      submitBlockedPaths.length > 0
        ? submitBlockedPaths
        : completion.required_missing.map((item) => item.path);
    return paths.map(
      (path) =>
        byPath.get(path) ??
        ({
          path,
          section: "",
          tier: "required",
          label_fr: path,
          label_ar: path,
          filled: false,
        } as CompletionFieldItem)
    );
  })();

  const requestExport = async (format: "pdf" | "xlsx") => {
    if (exportJobId && exportFormats.includes(format)) {
      await downloadExport(id, exportJobId, format);
      return;
    }
    setError("");
    try {
      const jobId = await startExport(id, format, {
        planTitle: plan?.title,
        onComplete: (formats) => {
          setExportFormats(formats);
          setExportJobId(jobId);
        },
      });
      setExportJobId(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : tPlan("exportFailed"));
    }
  };

  const scrollToWizard = () => {
    document.getElementById("liasse-wizard")?.scrollIntoView({ behavior: "smooth" });
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

      <div
        id="liasse-wizard"
        className="mb-2 flex flex-wrap items-center justify-between gap-3"
      >
        <h2 className="font-display text-xl font-semibold text-navy-800">
          {tPlan("liasseTitle")}
        </h2>
        <RoleGate role={["expert", "admin"]}>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-700 hover:border-gold-400"
            onClick={() => void downloadCompletenessReport(id)}
          >
            <FileBarChart className="h-4 w-4" />
            {tPlan("completenessReport")}
          </button>
        </RoleGate>
      </div>
      <p className="mb-6 text-sm text-navy-600">
        {tPlan("wizardIntro", { steps: 13 })}
        {collabEnabled ? ` ${tPlan("collabActive")}` : ""}
      </p>

      {error && <p className="form-error">{error}</p>}
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
              completion={completion}
              onRegisterNavigator={(fn) => {
                jumpToFieldRef.current = fn;
              }}
              onSave={(res) => {
                setPlan(res.plan);
                setCompletionKey((k) => k + 1);
              }}
              onPlanModuleChange={bumpCompletion}
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

      <PlanActionBar
        plan={plan}
        role={user?.role}
        busy={busyAction}
        exportFormats={exportFormats}
        onAction={{
          onSave: async () => {
            setBusyAction("save");
            try {
              const res = await saveInputs(id, inputs);
              setPlan(res.plan);
              setCompletionKey((k) => k + 1);
            } finally {
              setBusyAction("");
            }
          },
          onSubmit: async () => {
            if (completion && !completion.can_submit) {
              setSubmitBlockedPaths([]);
              setSubmitBlockedOpen(true);
              return;
            }
            setBusyAction("submit");
            setError("");
            try {
              await submitPlan(id);
              await load();
            } catch (e) {
              if (isApiHttpError(e, 422)) {
                setSubmitBlockedPaths(parseMissingFieldsFromApiError(e));
                setSubmitBlockedOpen(true);
              } else {
                setError(e instanceof Error ? e.message : "Erreur lors de la soumission");
              }
            } finally {
              setBusyAction("");
            }
          },
          onApprove: async () => {
            setBusyAction("approve");
            try {
              await transitionPlan(id, "VALIDATE");
              await load();
            } finally {
              setBusyAction("");
            }
          },
          onRequestAdjustment: async () => {
            setBusyAction("request_adjustment");
            try {
              await transitionPlan(id, "NEEDS_ADJUSTMENT");
              await load();
            } finally {
              setBusyAction("");
            }
          },
          onEdit: scrollToWizard,
          onResubmit: async () => {
            setBusyAction("resubmit");
            try {
              await resubmitPlan(id);
              await load();
            } finally {
              setBusyAction("");
            }
          },
          onExportPdf: () => void requestExport("pdf"),
          onExportXlsx: () => void requestExport("xlsx"),
          onExportGenerate: () => void requestExport("pdf"),
        }}
      />

      <SubmitBlockedModal
        open={submitBlockedOpen}
        onClose={() => setSubmitBlockedOpen(false)}
        requiredMissing={submitBlockedItems}
        onNavigate={(step, path) => {
          jumpToFieldRef.current?.(step, path);
          scrollToWizard();
          setSubmitBlockedOpen(false);
        }}
      />

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
