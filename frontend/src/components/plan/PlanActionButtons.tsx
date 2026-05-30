"use client";

import { useAuth } from "@/context/AuthContext";
import ActionBar, {
  type PlanAction,
  type PlanActionBusy,
} from "@/components/plan/ActionBar";
import type { PlanActions, PlanStatus } from "@/components/plan/getPlanActions";
import type { PlanActionHandlers } from "@/components/plan/PlanActionBar";

export type { PlanActionBusy, PlanActionHandlers };

type Props = {
  status: PlanStatus;
  busy?: PlanActionBusy;
  exportFormats?: string[];
  /** @deprecated Overrides are ignored; visibility uses status + role guards. */
  actions?: PlanActions;
  handlers: PlanActionHandlers;
  className?: string;
  role?: string;
};

function dispatchAction(action: PlanAction, handlers: PlanActionHandlers) {
  switch (action) {
    case "save":
      return handlers.onSave?.();
    case "submit_for_review":
      return handlers.onSubmit?.();
    case "approve":
      return handlers.onApprove?.();
    case "request_adjustment":
      return handlers.onRequestAdjustment?.();
    case "edit":
      return handlers.onEdit?.();
    case "resubmit":
      return handlers.onResubmit?.();
    case "export_pdf":
      return handlers.onExportPdf?.();
    case "export_xlsx":
      return handlers.onExportXlsx?.();
    case "export_generate":
      return handlers.onExportGenerate?.() ?? handlers.onExportPdf?.();
    default:
      return undefined;
  }
}

/** @deprecated Prefer `<ActionBar />` — kept for PlanOverviewCard and tests. */
export default function PlanActionButtons({
  status,
  busy = "",
  exportFormats = [],
  handlers,
  className = "",
  role: roleOverride,
}: Props) {
  const { user } = useAuth();
  const role = roleOverride ?? user?.role;

  return (
    <ActionBar
      status={status}
      role={role}
      busy={busy}
      exportFormats={exportFormats}
      className={className}
      onAction={(action) => {
        void dispatchAction(action, handlers);
      }}
    />
  );
}
