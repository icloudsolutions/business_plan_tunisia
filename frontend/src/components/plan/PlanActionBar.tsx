"use client";

import type { Plan } from "@/lib/api";
import PlanActionButtons, {
  type PlanActionBusy,
  type PlanActionHandlers,
} from "@/components/plan/PlanActionButtons";
import type { PlanStatus } from "@/components/plan/getPlanActions";

export type { PlanActionBusy };

type Props = {
  plan: Plan;
  busy: PlanActionBusy;
  exportFormats: string[];
  handlers: PlanActionHandlers;
};

/** Footer action bar on the plan detail page — driven by getActions(status, role). */
export default function PlanActionBar({
  plan,
  busy,
  exportFormats,
  handlers,
}: Props) {
  return (
    <PlanActionButtons
      status={plan.status as PlanStatus}
      busy={busy}
      exportFormats={exportFormats}
      handlers={handlers}
      className="plan-actions"
    />
  );
}
