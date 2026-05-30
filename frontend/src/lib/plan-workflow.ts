import type { PlanStatusHistoryEntry } from "@/lib/api";

export const WORKFLOW_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "ADJUSTMENT",
  "VALIDATED",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export function workflowStepIndex(status: string): number {
  const i = WORKFLOW_STATUSES.indexOf(status as WorkflowStatus);
  return i >= 0 ? i : 0;
}

export function timestampForStatus(
  history: PlanStatusHistoryEntry[] | undefined,
  status: string
): string | undefined {
  return history?.find((h) => h.status === status)?.changed_at;
}

export type WorkflowRole = "client" | "expert" | "admin";

export function normalizeWorkflowRole(
  role: string | undefined
): WorkflowRole {
  if (role === "expert" || role === "admin") return role;
  return "client";
}
