"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/EmptyState";
import { downloadExport } from "@/lib/api";
import { listPlanExports, type ExportJobSummary } from "@/lib/export-job-api";

type Props = {
  planId: string;
  active: boolean;
};

function formatWhen(iso: string) {
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

export default function PlanExportHistory({ planId, active }: Props) {
  const t = useTranslations("exportHistory");
  const [rows, setRows] = useState<ExportJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await listPlanExports(planId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-navy-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-8 text-center text-sm text-red-600">
        {error}
        <button type="button" className="ms-2 underline" onClick={() => void load()}>
          {t("retry")}
        </button>
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ArrowDownTrayIcon aria-hidden />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <ul className="space-y-2">
        {rows.map((job) => (
          <li
            key={job.id}
            className="rounded-lg border border-navy-100 bg-white p-3 text-sm shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <time className="text-xs text-navy-500">{formatWhen(job.created_at)}</time>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  job.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800"
                    : job.status === "FAILED"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-900"
                }`}
              >
                {job.status}
              </span>
            </div>
            {job.status === "COMPLETED" && job.formats.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {job.formats.includes("pdf") && (
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 hover:underline"
                    onClick={() => void downloadExport(planId, job.id, "pdf")}
                  >
                    PDF
                  </button>
                )}
                {job.formats.includes("xlsx") && (
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 hover:underline"
                    onClick={() => void downloadExport(planId, job.id, "xlsx")}
                  >
                    Excel
                  </button>
                )}
                {job.formats.includes("docx") && (
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 hover:underline"
                    onClick={() => void downloadExport(planId, job.id, "docx")}
                  >
                    Étude Word
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
