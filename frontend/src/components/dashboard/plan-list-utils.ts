import type { Plan } from "@/lib/api";
import { WORKFLOW_STATUSES } from "@/lib/plan-workflow";

export type PlanListRow = Plan & { created_at?: string; updated_at?: string };

export type PlanSortKey = "title" | "status" | "updated" | "completion";
export type SortDirection = "asc" | "desc";

export function planClientLabel(plan: PlanListRow): string {
  const inputs = plan.inputs as { company?: { name?: string } } | undefined;
  const name = inputs?.company?.name?.trim();
  return name || "";
}

export function planUpdatedAt(plan: PlanListRow): string {
  return plan.updated_at || plan.created_at || "";
}

function statusOrder(status: string): number {
  const i = WORKFLOW_STATUSES.indexOf(status as (typeof WORKFLOW_STATUSES)[number]);
  return i >= 0 ? i : WORKFLOW_STATUSES.length;
}

export function sortPlanRows(
  plans: PlanListRow[],
  key: PlanSortKey,
  direction: SortDirection,
  completionPct: (plan: PlanListRow) => number
): PlanListRow[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...plans].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "title":
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        break;
      case "status":
        cmp = statusOrder(a.status) - statusOrder(b.status);
        break;
      case "updated":
        cmp = planUpdatedAt(a).localeCompare(planUpdatedAt(b));
        break;
      case "completion":
        cmp = completionPct(a) - completionPct(b);
        break;
    }
    return cmp * dir;
  });
}
