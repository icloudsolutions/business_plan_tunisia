import { api } from "./api";

export interface PlanVersionSummary {
  id: string;
  plan_id: string;
  version_number: number;
  status_at_snapshot: string;
  reason: string;
  reason_label: string | null;
  created_at: string;
  created_by_id: string | null;
  created_by_email: string | null;
}

export interface VersionDiffItem {
  path: string;
  old_value: string | null;
  new_value: string | null;
  kind: "added" | "removed" | "changed";
}

export interface PlanVersionDiff {
  version_id: string;
  version_number: number;
  changes: VersionDiffItem[];
  change_count: number;
}

export interface AuditLogEntry {
  id: string;
  plan_id: string;
  user_id: string | null;
  user_email: string | null;
  field_path: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface VersionRestoreResult {
  plan_id: string;
  restored_version_id: string;
  message: string;
}

export async function listPlanVersions(planId: string): Promise<PlanVersionSummary[]> {
  return api(`/plans/${planId}/versions`);
}

export async function createPlanSnapshot(planId: string): Promise<PlanVersionSummary> {
  return api(`/plans/${planId}/versions`, {
    method: "POST",
    body: JSON.stringify({ reason: "manual" }),
  });
}

export async function diffPlanVersion(
  planId: string,
  versionId: string
): Promise<PlanVersionDiff> {
  return api(`/plans/${planId}/versions/${versionId}/diff`);
}

export async function restorePlanVersion(
  planId: string,
  versionId: string
): Promise<VersionRestoreResult> {
  return api(`/plans/${planId}/versions/${versionId}/restore`, { method: "POST" });
}

export async function listPlanAuditLog(planId: string, limit = 200): Promise<AuditLogEntry[]> {
  return api(`/plans/${planId}/audit-log?limit=${limit}`);
}
