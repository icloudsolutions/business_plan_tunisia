import { api } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export type ExportJobStatus = {
  id: string;
  status: string;
  formats: string[];
  files: Record<string, string>;
  error?: string;
};

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
  format: "pdf" | "xlsx"
): string {
  return `${API_BASE}/plans/${planId}/exports/${jobId}/download?format=${format}`;
}
