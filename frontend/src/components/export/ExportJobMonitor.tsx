"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { downloadExport, exportPlan, type ExportFormat } from "@/lib/api";
import { ALL_EXPORT_FORMATS } from "@/lib/export-formats";
import {
  exportDownloadUrl,
  getExportJob,
  normalizeExportJobStatus,
} from "@/lib/export-job-api";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
} from "@/components/ui/toast";
import ExportProgressBar from "./ExportProgressBar";

const POLL_MS = 2000;
const FAKE_PROGRESS_STEP_MS = 1000;
const FAKE_PROGRESS_STEP = 8;
const FAKE_PROGRESS_CAP = 85;

export type ExportJobMonitorProps = {
  planId: string;
  jobId: string;
  format: ExportFormat;
  planTitle?: string;
  onComplete?: (formats: string[]) => void;
  onDismiss?: () => void;
};

type MonitorStatus = "pending" | "running" | "done" | "error";

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
  const [status, setStatus] = useState<MonitorStatus>("pending");
  const [fakeProgress, setFakeProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState(jobId);
  const completedRef = useRef(false);

  const formatLabel =
    format === "pdf"
      ? "PDF"
      : format === "docx"
        ? "Word"
        : format === "pptx"
          ? "PowerPoint"
          : "Excel";
  const downloadUrl = exportDownloadUrl(planId, activeJobId, format);

  const statusLabel: Record<MonitorStatus, string> = {
    pending: t("statusPending"),
    running: t("statusRunning"),
    done: t("statusDone"),
    error: t("statusError"),
  };

  useEffect(() => {
    setActiveJobId(jobId);
    setStatus("pending");
    setFakeProgress(0);
    setErrorMessage("");
    completedRef.current = false;
  }, [jobId]);

  useEffect(() => {
    if (status === "done" || status === "error") return;

    const timer = window.setInterval(() => {
      setFakeProgress((p) => {
        if (p >= FAKE_PROGRESS_CAP) return p;
        return Math.min(p + FAKE_PROGRESS_STEP, FAKE_PROGRESS_CAP);
      });
    }, FAKE_PROGRESS_STEP_MS);

    return () => window.clearInterval(timer);
  }, [status]);

  const poll = useCallback(async () => {
    try {
      const job = await getExportJob(planId, activeJobId);
      const phase = normalizeExportJobStatus(job.status);

      if (phase === "error") {
        setStatus("error");
        setErrorMessage(job.error || t("failed"));
        return;
      }

      if (phase === "done") {
        const list = job.formats?.length
          ? job.formats
          : Object.keys(job.files ?? {});
        setFormats(list);
        setFakeProgress(100);
        setStatus("done");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(list);
        }
        return;
      }

      if (
        typeof job.progress_pct === "number" &&
        job.progress_pct > 0 &&
        phase === "running"
      ) {
        setFakeProgress(Math.min(job.progress_pct, 100));
      }

      setStatus(phase === "running" ? "running" : "pending");
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : t("failed"));
    }
  }, [activeJobId, onComplete, planId, t]);

  useEffect(() => {
    if (status === "done" || status === "error") return;

    void poll();
    const pollId = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(pollId);
  }, [poll, status]);

  const handleRetry = async () => {
    setStatus("pending");
    setFakeProgress(0);
    setErrorMessage("");
    completedRef.current = false;
    try {
      const job = await exportPlan(planId, ALL_EXPORT_FORMATS);
      setActiveJobId(job.id);
    } catch (e) {
      setStatus("error");
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

  const showProgress = status === "pending" || status === "running";
  const title = planTitle
    ? `${planTitle} — ${formatLabel} — ${statusLabel[status]}`
    : `${formatLabel} — ${statusLabel[status]}`;

  return (
    <Toast open={open} onOpenChange={handleOpenChange} duration={Infinity}>
      <ToastTitle>{title}</ToastTitle>
      <ToastDescription asChild>
        <div className="space-y-2 pe-6">
          {showProgress && (
            <div className="space-y-1.5">
              <p className="text-sm text-navy-600">
                {status === "pending" ? t("pending") : t("inProgress")}
              </p>
              <ExportProgressBar value={fakeProgress} />
            </div>
          )}

          {status === "done" && (
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

          {status === "error" && (
            <div className="space-y-2">
              <p className="flex items-start gap-1.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {errorMessage}
              </p>
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
      <ToastClose />
    </Toast>
  );
}
