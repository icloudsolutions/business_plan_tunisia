"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale as useIntlLocale } from "next-intl";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import { Download, Edit3, Send, Loader2 } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import {
  exportPlan,
  pollJob,
  resubmitPlan,
  submitPlan,
  downloadExport,
  type Plan,
} from "@/lib/api";
import SubmitBlockedModal from "@/components/completion/SubmitBlockedModal";
import type { PlanCompletion } from "@/lib/completion";
import { extractSector } from "@/lib/plan-completion";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";
import WorkflowStepper from "./WorkflowStepper";
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
  const { isClient, isExpert } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitBlockedOpen, setSubmitBlockedOpen] = useState(false);

  const percent = completion?.overall_pct ?? 0;
  const sector = extractSector(plan);
  const dateStr = createdAt
    ? formatDate(createdAt, locale, { dateStyle: "long" })
    : "—";

  const handleContinue = () => router.push(`/plans/${plan.id}`);

  const handleSubmit = async () => {
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
      setBusy(null);
    }
  };

  const handleResubmit = async () => {
    setBusy("resubmit");
    setMessage("");
    try {
      await resubmitPlan(plan.id);
      setMessage(t("resubmitSuccess"));
      onRefresh?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    setBusy("pdf");
    setMessage("");
    try {
      const job = await exportPlan(plan.id);
      const result = await pollJob(job.id);
      if (result.status === "COMPLETED") {
        await downloadExport(plan.id, job.id, "pdf");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const canSubmit = isClient && plan.status === "DRAFT";
  const canResubmit = isClient && plan.status === "ADJUSTMENT";
  const canDownload = plan.status === "VALIDATED";

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
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-400/90">
          {t("planOverview")}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
          {plan.title}
        </h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-navy-200">
          <span>
            <span className="text-gold-300/80">{t("sector")}:</span> {sector}
          </span>
          <span>
            <span className="text-gold-300/80">{t("created")}:</span> {dateStr}
          </span>
        </div>
      </div>

      <div className="grid gap-8 p-5 sm:grid-cols-[1fr_auto] sm:p-8">
        <div className="space-y-8">
          <WorkflowStepper status={plan.status} />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-700"
            >
              <Edit3 className="h-4 w-4" />
              {t("continueEdit")}
            </button>
            {canSubmit && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gold-500 bg-gold-50 px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-gold-100 disabled:opacity-50"
              >
                {busy === "submit" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("requestReview")}
              </button>
            )}
            {canResubmit && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleResubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gold-500 bg-gold-50 px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-gold-100 disabled:opacity-50"
              >
                {busy === "resubmit" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("resubmitCorrections")}
              </button>
            )}
            {canDownload && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleDownloadPdf}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:border-gold-400 hover:bg-navy-50 disabled:opacity-50"
              >
                {busy === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {busy === "pdf" ? t("exportPreparing") : t("downloadPdf")}
              </button>
            )}
            {isExpert && plan.status !== "VALIDATED" && (
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy-200 px-5 py-3 text-sm font-medium text-navy-700"
              >
                {t("openPlan")}
              </button>
            )}
          </div>
          {message && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          )}
        </div>
        <div className="flex justify-center sm:justify-end">
          <CompletionRing percent={percent} size={128} />
        </div>
      </div>
    </article>
    </>
  );
}
