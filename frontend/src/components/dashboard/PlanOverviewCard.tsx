"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale as useIntlLocale } from "next-intl";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import { useLocale } from "@/context/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import PlanActionButtons, {
  type PlanActionBusy,
} from "@/components/plan/PlanActionButtons";
import type { PlanStatus } from "@/components/plan/getPlanActions";
import {
  resubmitPlan,
  submitPlan,
  transitionPlan,
  downloadExport,
  type Plan,
} from "@/lib/api";
import { formatApproveBlockedMessage } from "@/lib/api-errors";
import { runExpertApprove } from "@/lib/expert-approve";
import { useExportJobs } from "@/context/ExportJobsContext";
import SubmitBlockedModal from "@/components/completion/SubmitBlockedModal";
import type { PlanCompletion } from "@/lib/completion";
import { extractSector } from "@/lib/plan-completion";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";
import WorkflowStepper from "@/components/plan/WorkflowStepper";
import { normalizeWorkflowRole } from "@/lib/plan-workflow";
import CompletionRing from "./CompletionRing";

export default function PlanOverviewCard({
  plan,
  completion,
  createdAt,
  onRefresh,
  onJumpToField,
}: {
  plan: Plan;
  completion?: PlanCompletion | null;
  createdAt?: string;
  onRefresh?: () => void;
  onJumpToField?: (step: WizardStepId, fieldPath: string) => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const locale = useIntlLocale() as AppLocale;
  const { user } = useAuth();
  const [busy, setBusy] = useState<PlanActionBusy>("");
  const [message, setMessage] = useState("");
  const [submitBlockedOpen, setSubmitBlockedOpen] = useState(false);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportFormats, setExportFormats] = useState<string[]>([]);
  const { startExport } = useExportJobs();

  const percent = completion?.overall_pct ?? 0;
  const sector = extractSector(plan);
  const dateStr = createdAt
    ? formatDate(createdAt, locale, { dateStyle: "long" })
    : "—";

  const openPlan = () => router.push(`/plans/${plan.id}`);

  const requestExport = async (format: "pdf" | "xlsx") => {
    if (exportJobId && exportFormats.includes(format)) {
      await downloadExport(plan.id, exportJobId, format);
      return;
    }
    setMessage("");
    try {
      const jobId = await startExport(plan.id, format, {
        planTitle: plan.title,
        onComplete: (formats) => {
          setExportFormats(formats);
          setExportJobId(jobId);
        },
      });
      setExportJobId(jobId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    }
  };

  const actionBar = (
    <PlanActionButtons
      status={plan.status as PlanStatus}
      busy={busy}
      exportFormats={exportFormats}
      handlers={{
        onSave: openPlan,
        onSubmit: async () => {
          if (completion && !completion.can_submit) {
            setSubmitBlockedOpen(true);
            return;
          }
          setBusy("submit");
          setMessage("");
          try {
            await submitPlan(plan.id);
            setMessage(t("submitSuccess"));
            onRefresh?.();
          } catch (e) {
            const err = e instanceof Error ? e.message : "Erreur";
            if (err.includes("missingFields") || err.includes("422")) {
              setSubmitBlockedOpen(true);
            } else {
              setMessage(err);
            }
          } finally {
            setBusy("");
          }
        },
        onEdit: openPlan,
        onResubmit: async () => {
          setBusy("resubmit");
          setMessage("");
          try {
            await resubmitPlan(plan.id);
            setMessage(t("resubmitSuccess"));
            onRefresh?.();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Erreur");
          } finally {
            setBusy("");
          }
        },
        onApprove: async () => {
          setBusy("approve");
          setMessage("");
          try {
            const outcome = await runExpertApprove(plan.id);
            if (!outcome.ok) {
              setMessage(formatApproveBlockedMessage(outcome.audit));
              openPlan();
              return;
            }
            setMessage("Plan validé.");
            onRefresh?.();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Erreur");
          } finally {
            setBusy("");
          }
        },
        onRequestAdjustment: async () => {
          setBusy("request_adjustment");
          try {
            await transitionPlan(plan.id, "NEEDS_ADJUSTMENT");
            onRefresh?.();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Erreur");
          } finally {
            setBusy("");
          }
        },
        onExportPdf: () => void requestExport("pdf"),
        onExportXlsx: () => void requestExport("xlsx"),
      }}
    />
  );

  return (
    <>
      <SubmitBlockedModal
        open={submitBlockedOpen}
        onClose={() => setSubmitBlockedOpen(false)}
        requiredMissing={completion?.required_missing ?? []}
        onNavigate={(step, path) => {
          onJumpToField?.(step, path);
          router.push(`/plans/${plan.id}`);
        }}
      />
      <article className="overflow-hidden rounded-2xl border border-navy-100/80 bg-white shadow-xl shadow-navy-900/5">
        <div className="border-b border-gold-200/50 bg-gradient-to-r from-navy-800 via-navy-800 to-navy-700 px-5 py-6 sm:px-8 sm:py-7">
          <p className="truncate text-xs font-semibold uppercase tracking-widest text-gold-400/90">
            {t("planOverview")}
          </p>
          <h2 className="mt-1 truncate font-display text-2xl font-semibold text-white sm:text-3xl">
            {plan.title}
          </h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-navy-200">
            <span className="min-w-0 truncate">
              <span className="text-gold-300/80">{t("sector")}:</span> {sector}
            </span>
            <span className="min-w-0 truncate">
              <span className="text-gold-300/80">{t("created")}:</span> {dateStr}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-8">
          <div className="min-w-0 space-y-6">
            <WorkflowStepper
              status={plan.status}
              role={normalizeWorkflowRole(user?.role)}
              history={plan.history}
              showHeading
            />
            {actionBar}
            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {message}
              </p>
            )}
          </div>
          <div className="flex shrink-0 justify-center sm:justify-end">
            <CompletionRing percent={percent} />
          </div>
        </div>
      </article>
    </>
  );
}
