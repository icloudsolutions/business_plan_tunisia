"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import ExportSplitButton from "@/components/plan/ExportSplitButton";
import {
  btnDestructive,
  btnPrimary,
  btnSecondary,
} from "@/components/plan/plan-action-styles";
import { planRoleFromUser, type PlanStatus } from "@/components/plan/getPlanActions";
import { FOCUS_RING } from "@/lib/a11y";

export type PlanAction =
  | "save"
  | "submit_for_review"
  | "approve"
  | "request_adjustment"
  | "edit"
  | "resubmit"
  | "export_pdf"
  | "export_xlsx"
  | "export_generate"
  | "cancel"
  | "delete";

export type PlanActionBusy =
  | ""
  | "save"
  | "submit"
  | "approve"
  | "request_adjustment"
  | "resubmit"
  | "export"
  | "delete";

type Props = {
  status: PlanStatus;
  /** JWT role: client | expert | admin */
  role: string | undefined;
  onAction: (action: PlanAction) => void;
  busy?: PlanActionBusy;
  /** Available export formats from last job, e.g. ["pdf","xlsx"] */
  exportFormats?: string[];
  className?: string;
  /** Show delete for draft owner (destructive). */
  allowDelete?: boolean;
  /** Show cancel link (destructive). */
  allowCancel?: boolean;
};

function busyFor(action: PlanAction): PlanActionBusy | null {
  switch (action) {
    case "save":
      return "save";
    case "submit_for_review":
      return "submit";
    case "approve":
      return "approve";
    case "request_adjustment":
      return "request_adjustment";
    case "resubmit":
      return "resubmit";
    case "export_pdf":
    case "export_xlsx":
    case "export_generate":
      return "export";
    case "delete":
      return "delete";
    default:
      return null;
  }
}

function PrimaryButton({
  label,
  action,
  busy,
  disabled,
  onAction,
}: {
  label: string;
  action: PlanAction;
  busy: PlanActionBusy;
  disabled: boolean;
  onAction: (action: PlanAction) => void;
}) {
  const key = busyFor(action);
  const loading = key !== null && busy === key;
  return (
    <button
      type="button"
      className={btnPrimary}
      disabled={disabled || loading}
      onClick={() => onAction(action)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

function SecondaryButton({
  label,
  action,
  busy,
  disabled,
  onAction,
}: {
  label: string;
  action: PlanAction;
  busy: PlanActionBusy;
  disabled: boolean;
  onAction: (action: PlanAction) => void;
}) {
  const key = busyFor(action);
  const loading = key !== null && busy === key;
  return (
    <button
      type="button"
      className={btnSecondary}
      disabled={disabled || loading}
      onClick={() => onAction(action)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

function DestructiveButton({
  label,
  action,
  busy,
  disabled,
  onAction,
}: {
  label: string;
  action: PlanAction;
  busy: PlanActionBusy;
  disabled: boolean;
  onAction: (action: PlanAction) => void;
}) {
  const key = busyFor(action);
  const loading = key !== null && busy === key;
  return (
    <button
      type="button"
      className={`${btnDestructive} ${FOCUS_RING} disabled:opacity-55`}
      disabled={disabled || loading}
      onClick={() => onAction(action)}
    >
      {loading ? <Loader2 className="me-1 inline h-3 w-3 animate-spin" aria-hidden /> : null}
      {label}
    </button>
  );
}

/**
 * Plan workflow actions with a single primary CTA, limited secondaries, and export split menu.
 * Returns null when no actions apply for the current status/role.
 */
export default function ActionBar({
  status,
  role,
  onAction,
  busy = "",
  exportFormats = [],
  className = "",
  allowDelete = false,
  allowCancel = false,
}: Props) {
  const t = useTranslations("plan");
  const workflowRole = planRoleFromUser(role);
  const isClient = role === "client";
  const isExpert = workflowRole === "expert";

  const canSave = isClient && status === "DRAFT";
  const canSubmit = isClient && status === "DRAFT";
  const canEdit = isClient && status === "ADJUSTMENT";
  const canResubmit = isClient && status === "ADJUSTMENT";
  const canApprove =
    isExpert && (status === "UNDER_REVIEW" || status === "ADJUSTMENT");
  const canRequestAdjustment = isExpert && status === "UNDER_REVIEW";
  const canExport = status === "VALIDATED";
  const canDelete = allowDelete && isClient && status === "DRAFT";
  const canCancel = allowCancel && isClient && status === "DRAFT";

  const disabled = busy !== "";
  const canPdf = exportFormats.includes("pdf");
  const canXlsx = exportFormats.includes("xlsx");

  const exportSplit = (variant: "primary" | "secondary") =>
    canExport ? (
      <ExportSplitButton
        key={`export-${variant}`}
        variant={variant}
        label={t("exportMenu")}
      pdfLabel={t("exportPdf")}
      xlsxLabel={t("exportXlsx")}
      regenerateLabel={t("exportGenerate")}
      busy={busy === "export"}
      canPdf={canPdf}
      canXlsx={canXlsx}
      onGenerate={() => onAction("export_generate")}
      onDownloadPdf={() => onAction("export_pdf")}
      onDownloadXlsx={() => onAction("export_xlsx")}
      />
    ) : null;

  let primary: ReactNode = null;
  const secondary: ReactNode[] = [];
  const destructive: ReactNode[] = [];

  if (canSubmit) {
    primary = (
      <PrimaryButton
        label={t("submitForReview")}
        action="submit_for_review"
        busy={busy}
        disabled={disabled}
        onAction={onAction}
      />
    );
    if (canSave) {
      secondary.push(
        <SecondaryButton
          key="save"
          label={t("saveDraft")}
          action="save"
          busy={busy}
          disabled={disabled}
          onAction={onAction}
        />
      );
    }
  } else if (canResubmit) {
    primary = (
      <PrimaryButton
        label={t("resubmit")}
        action="resubmit"
        busy={busy}
        disabled={disabled}
        onAction={onAction}
      />
    );
    if (canEdit) {
      secondary.push(
        <SecondaryButton
          key="edit"
          label={t("editPlan")}
          action="edit"
          busy={busy}
          disabled={disabled}
          onAction={onAction}
        />
      );
    }
  } else if (canApprove) {
    primary = (
      <PrimaryButton
        label={t("approve")}
        action="approve"
        busy={busy}
        disabled={disabled}
        onAction={onAction}
      />
    );
    if (canRequestAdjustment) {
      secondary.push(
        <SecondaryButton
          key="adjust"
          label={t("requestAdjustment")}
          action="request_adjustment"
          busy={busy}
          disabled={disabled}
          onAction={onAction}
        />
      );
    }
  } else if (canExport) {
    primary = exportSplit("primary");
  }

  if (canCancel) {
    destructive.push(
      <DestructiveButton
        key="cancel"
        label={t("cancel")}
        action="cancel"
        busy={busy}
        disabled={disabled}
        onAction={onAction}
      />
    );
  }
  if (canDelete) {
    destructive.push(
      <DestructiveButton
        key="delete"
        label={t("deletePlan")}
        action="delete"
        busy={busy}
        disabled={disabled}
        onAction={onAction}
      />
    );
  }

  const nodes = [primary, ...secondary, ...destructive].filter(Boolean);
  if (nodes.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 sm:gap-3 ${className}`.trim()}
      role="toolbar"
      aria-label={t("actionsToolbar")}
    >
      {nodes}
    </div>
  );
}
