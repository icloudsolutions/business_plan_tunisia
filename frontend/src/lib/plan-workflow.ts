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

export function historyEntryForStatus(
  history: PlanStatusHistoryEntry[] | undefined,
  status: string
): PlanStatusHistoryEntry | undefined {
  return history?.find((h) => h.status === status);
}

export function timestampForStatus(
  history: PlanStatusHistoryEntry[] | undefined,
  status: string
): string | undefined {
  return historyEntryForStatus(history, status)?.changed_at;
}

export function changedByForStatus(
  history: PlanStatusHistoryEntry[] | undefined,
  status: string
): string | undefined {
  const entry = historyEntryForStatus(history, status);
  const name = entry?.changed_by;
  return name && name.trim() ? name.trim() : undefined;
}

export type WorkflowRole = "client" | "expert" | "admin";

export function normalizeWorkflowRole(
  role: string | undefined
): WorkflowRole {
  if (role === "expert" || role === "admin") return role;
  return "client";
}
