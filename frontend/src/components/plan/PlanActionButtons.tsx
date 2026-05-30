"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import {
  getActions,
  hasVisibleActions,
  planRoleFromUser,
  type PlanActionId,
  type PlanActions,
  type PlanStatus,
} from "@/components/plan/getPlanActions";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
} from "@/components/plan/plan-action-styles";

export type PlanActionBusy =
  | ""
  | "save"
  | "submit"
  | "approve"
  | "request_adjustment"
  | "resubmit"
  | "export";

export type PlanActionHandlers = {
  onSave?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
  onApprove?: () => void | Promise<void>;
  onRequestAdjustment?: () => void | Promise<void>;
  onEdit?: () => void;
  onResubmit?: () => void | Promise<void>;
  onExportPdf?: () => void | Promise<void>;
  onExportXlsx?: () => void | Promise<void>;
};

type Props = {
  status: PlanStatus;
  busy?: PlanActionBusy;
  exportFormats?: string[];
  /** Override actions (e.g. tests); defaults to getActions(status, role). */
  actions?: PlanActions;
  handlers: PlanActionHandlers;
  className?: string;
};

function labelFor(id: PlanActionId, t: ReturnType<typeof useTranslations<"plan">>): string {
  const map: Record<PlanActionId, string> = {
    save: t("saveDraft"),
    submit_for_review: t("submitForReview"),
    approve: t("approve"),
    request_adjustment: t("requestAdjustment"),
    edit: t("editPlan"),
    resubmit: t("resubmit"),
    export_pdf: t("exportPdf"),
    export_xlsx: t("exportXlsx"),
  };
  return map[id];
}

function busyKeyFor(id: PlanActionId): PlanActionBusy | null {
  if (id === "save") return "save";
  if (id === "submit_for_review") return "submit";
  if (id === "approve") return "approve";
  if (id === "request_adjustment") return "request_adjustment";
  if (id === "resubmit") return "resubmit";
  if (id === "export_pdf" || id === "export_xlsx") return "export";
  return null;
}

function handlerFor(id: PlanActionId, h: PlanActionHandlers): (() => void) | undefined {
  switch (id) {
    case "save":
      return h.onSave ? () => void h.onSave!() : undefined;
    case "submit_for_review":
      return h.onSubmit ? () => void h.onSubmit!() : undefined;
    case "approve":
      return h.onApprove ? () => void h.onApprove!() : undefined;
    case "request_adjustment":
      return h.onRequestAdjustment ? () => void h.onRequestAdjustment!() : undefined;
    case "edit":
      return h.onEdit;
    case "resubmit":
      return h.onResubmit ? () => void h.onResubmit!() : undefined;
    case "export_pdf":
      return h.onExportPdf ? () => void h.onExportPdf!() : undefined;
    case "export_xlsx":
      return h.onExportXlsx ? () => void h.onExportXlsx!() : undefined;
    default:
      return undefined;
  }
}

function ActionButton({
  id,
  variant,
  busy,
  disabled,
  onClick,
  label,
}: {
  id: PlanActionId;
  variant: "primary" | "secondary" | "ghost";
  busy: PlanActionBusy;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const busyKey = busyKeyFor(id);
  const isLoading = busyKey !== null && busy === busyKey;
  const className =
    variant === "primary"
      ? btnPrimary
      : variant === "ghost"
        ? btnGhost
        : btnSecondary;

  return (
    <button
      type="button"
      className={className}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

/**
 * Renders workflow actions from getActions(status, role).
 * Returns null when all action arrays are empty (no ghost toolbar space).
 */
export default function PlanActionButtons({
  status,
  busy = "",
  exportFormats = [],
  actions: actionsOverride,
  handlers,
  className = "",
}: Props) {
  const t = useTranslations("plan");
  const { user } = useAuth();
  const role = planRoleFromUser(user?.role);
  const actions = actionsOverride ?? getActions(status, role);

  if (!hasVisibleActions(actions)) {
    return null;
  }

  const disabled = busy !== "";

  const renderOne = (id: PlanActionId, variant: "primary" | "secondary" | "ghost") => {
    const onClick = handlerFor(id, handlers);
    if (!onClick) return null;
    const formatKey = id === "export_pdf" ? "pdf" : id === "export_xlsx" ? "xlsx" : null;
    if (formatKey && exportFormats.length > 0 && !exportFormats.includes(formatKey)) {
      return null;
    }
    return (
      <ActionButton
        key={id}
        id={id}
        variant={variant}
        busy={busy}
        disabled={disabled}
        onClick={onClick}
        label={labelFor(id, t)}
      />
    );
  };

  const primary = actions.primary ? renderOne(actions.primary, "primary") : null;
  const secondary = actions.secondary
    .map((id) => renderOne(id, "secondary"))
    .filter(Boolean);
  const exports = actions.exports
    .map((id) => renderOne(id, "secondary"))
    .filter(Boolean);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`.trim()}
      role="toolbar"
      aria-label={t("actionsToolbar")}
    >
      {primary}
      {secondary}
      {exports}
    </div>
  );
}
