import { api } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ExportJobStatus = {
  id: string;
  status: string;
  formats: string[];
  files: Record<string, string>;
  error?: string;
  /** Present when the job completed successfully (authenticated download path). */
  downloadUrl?: string;
  /** Export pack « all » (Excel + Word + PPTX → ZIP) */
  progress_pct?: number;
  files_ready?: string[];
  zip_url?: string;
};

export type ExportPackStatus = {
  job_id: string;
  status: string;
  progress_pct: number;
  files_ready: string[];
  zip_url: string | null;
  files?: Record<string, string>;
};

/** Maps API / Celery statuses to monitor phases. */
export function normalizeExportJobStatus(
  raw: string | undefined
): "pending" | "running" | "done" | "error" {
  const s = (raw ?? "PENDING").toUpperCase();
  if (s === "COMPLETED" || s === "SUCCESS") return "done";
  if (s === "FAILED" || s === "FAILURE") return "error";
  if (s === "STARTED" || s === "RUNNING") return "running";
  return "pending";
}

export type ExportJobSummary = {
  id: string;
  plan_id: string;
  status: string;
  format: string;
  formats: string[];
  created_at: string;
};

export async function listPlanExports(planId: string): Promise<ExportJobSummary[]> {
  return api<ExportJobSummary[]>(`/plans/${planId}/exports`);
}

export async function getExportJob(
  planId: string,
  jobId: string
): Promise<ExportJobStatus> {
  return api<ExportJobStatus>(`/plans/${planId}/exports/${jobId}`);
}

/** URL for display; download still uses authenticated fetch via downloadExport(). */
export function exportDownloadUrl(
  planId: string,
  jobId: string,
  format: "pdf" | "xlsx" | "docx" | "pptx" | "zip"
): string {
  return `${API_BASE}/plans/${planId}/exports/${jobId}/download?format=${format}`;
}

export async function startExportAll(
  planId: string,
  audience: "banque" | "investisseur" | "client" = "banque"
): Promise<{ job_id: string; status: string; celery_task_id?: string }> {
  return api(`/plans/${planId}/exports/all`, {
    method: "POST",
    body: JSON.stringify({ audience }),
  });
}

export async function getExportPackStatus(
  planId: string,
  jobId: string
): Promise<ExportPackStatus> {
  return api<ExportPackStatus>(`/plans/${planId}/exports/${jobId}/status`);
}
