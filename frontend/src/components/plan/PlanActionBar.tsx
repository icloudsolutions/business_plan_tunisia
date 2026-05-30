"use client";

import type { Plan } from "@/lib/api";
import ActionBar, {
  type PlanAction,
  type PlanActionBusy,
} from "@/components/plan/ActionBar";
import type { PlanStatus } from "@/components/plan/getPlanActions";

export type { PlanActionBusy };

export type PlanActionHandlers = {
  onSave?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
  onApprove?: () => void | Promise<void>;
  onRequestAdjustment?: () => void | Promise<void>;
  onEdit?: () => void;
  onResubmit?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  onExportXlsx?: () => void | Promise<void>;
  onExportGenerate?: () => void | Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void | Promise<void>;
};

type Props = {
  plan: Plan;
  role: string | undefined;
  busy: PlanActionBusy;
  exportFormats: string[];
  onAction: PlanActionHandlers;
  className?: string;
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
    case "cancel":
      return handlers.onCancel?.();
    case "delete":
      return handlers.onDelete?.();
    default:
      return undefined;
  }
}

/** Footer action bar on the plan detail page. */
export default function PlanActionBar({
  plan,
  role,
  busy,
  exportFormats,
  onAction: handlers,
  className,
}: Props) {
  return (
    <ActionBar
      status={plan.status as PlanStatus}
      role={role}
      busy={busy}
      exportFormats={exportFormats}
      allowDelete={Boolean(handlers.onDelete)}
      allowCancel={Boolean(handlers.onCancel)}
      className={className ?? "plan-actions"}
      onAction={(action) => {
        void dispatchAction(action, handlers);
      }}
    />
  );
}
