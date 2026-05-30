"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { downloadExport, exportPlan } from "@/lib/api";
import { exportDownloadUrl, getExportJob } from "@/lib/export-job-api";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast";

const POLL_MS = 2000;
const FAKE_PROGRESS_MS = 10_000;
const FAKE_PROGRESS_CAP = 90;

export type ExportJobMonitorProps = {
  planId: string;
  jobId: string;
  format: "pdf" | "xlsx";
  planTitle?: string;
  onComplete?: (formats: string[]) => void;
  onDismiss?: () => void;
};

type Phase = "pending" | "running" | "done" | "error";

export default function ExportJobMonitor({
  planId,
  jobId,
  format,
  planTitle,
  onComplete,
  onDismiss,
}: ExportJobMonitorProps) {
  const t = useTranslations("export");
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<Phase>("pending");
  const [fakeProgress, setFakeProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState(jobId);
  const startRef = useRef(Date.now());
  const completedRef = useRef(false);

  const formatLabel = format === "pdf" ? "PDF" : "Excel";
  const FormatIcon = format === "pdf" ? FileText : FileSpreadsheet;
  const downloadUrl = exportDownloadUrl(planId, activeJobId, format);

  useEffect(() => {
    setActiveJobId(jobId);
    setPhase("pending");
    setFakeProgress(0);
    setErrorMessage("");
    startRef.current = Date.now();
    completedRef.current = false;
  }, [jobId]);

  useEffect(() => {
    if (phase !== "pending" && phase !== "running") return;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(
        FAKE_PROGRESS_CAP,
        Math.round((elapsed / FAKE_PROGRESS_MS) * FAKE_PROGRESS_CAP)
      );
      setFakeProgress(pct);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  const poll = useCallback(async () => {
    try {
      const job = await getExportJob(planId, activeJobId);
      const status = job.status?.toUpperCase() ?? "PENDING";

      if (status === "FAILED") {
        setPhase("error");
        setErrorMessage(job.error || t("failed"));
        return;
      }

      if (status === "COMPLETED") {
        const list = job.formats?.length
          ? job.formats
          : Object.keys(job.files ?? {});
        setFormats(list);
        setFakeProgress(100);
        setPhase("done");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(list);
        }
        return;
      }

      if (status === "STARTED") {
        setPhase("running");
      } else {
        setPhase((p) => (p === "running" ? p : "pending"));
      }
    } catch (e) {
      setPhase("error");
      setErrorMessage(e instanceof Error ? e.message : t("failed"));
    }
  }, [activeJobId, onComplete, planId, t]);

  useEffect(() => {
    if (phase === "done" || phase === "error") return;

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [poll, phase]);

  const handleRetry = async () => {
    setPhase("pending");
    setFakeProgress(0);
    setErrorMessage("");
    startRef.current = Date.now();
    completedRef.current = false;
    try {
      const job = await exportPlan(planId);
      setActiveJobId(job.id);
    } catch (e) {
      setPhase("error");
      setErrorMessage(e instanceof Error ? e.message : t("failed"));
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    void downloadExport(planId, activeJobId, format);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onDismiss?.();
  };

  const title = planTitle
    ? t("titleWithPlan", { plan: planTitle, format: formatLabel })
    : t("title", { format: formatLabel });

  return (
    <Toast open={open} onOpenChange={handleOpenChange} duration={Infinity}>
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">
          {phase === "pending" && (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden />
          )}
          {phase === "running" && (
            <FormatIcon className="h-5 w-5 text-indigo-600" aria-hidden />
          )}
          {phase === "done" && (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          )}
          {phase === "error" && (
            <AlertCircle className="h-5 w-5 text-red-600" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <ToastTitle>{title}</ToastTitle>
          <ToastDescription asChild>
            <div className="space-y-2">
              {phase === "pending" && (
                <p className="flex items-center gap-2 text-sm text-navy-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  {t("pending")}
                </p>
              )}

              {phase === "running" && (
                <div className="space-y-1.5">
                  <p className="text-sm text-navy-600">{t("inProgress")}</p>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100"
                    role="progressbar"
                    aria-valuenow={fakeProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
                      style={{ width: `${fakeProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {phase === "done" && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    {t("ready")}
                  </p>
                  {formats.includes(format) ? (
                    <a
                      href={downloadUrl}
                      download
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      {t("download", { format: formatLabel })}
                    </a>
                  ) : (
                    <p className="text-xs text-navy-500">{t("formatUnavailable")}</p>
                  )}
                </div>
              )}

              {phase === "error" && (
                <div className="space-y-2">
                  <p className="text-sm text-red-700">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => void handleRetry()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    {t("retry")}
                  </button>
                </div>
              )}
            </div>
          </ToastDescription>
        </div>
      </div>
      <ToastClose />
    </Toast>
  );
}
