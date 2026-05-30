"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import {
  getActions,
  planRoleFromUser,
  type PlanActionId,
  type PlanStatus,
} from "@/components/plan/getPlanActions";
import { btnPrimary } from "@/components/plan/plan-action-styles";
import type { PlanListRow } from "./plan-list-utils";

function primaryLabel(
  id: PlanActionId,
  tPlan: ReturnType<typeof useTranslations<"plan">>,
  tDash: ReturnType<typeof useTranslations<"dashboard">>
): string {
  const dash: Partial<Record<PlanActionId, string>> = {
    save: tDash("continueEdit"),
    submit_for_review: tDash("requestReview"),
    edit: tDash("openPlan"),
    resubmit: tDash("resubmitCorrections"),
  };
  if (dash[id]) return dash[id]!;
  const planLabels: Partial<Record<PlanActionId, string>> = {
    approve: tPlan("approve"),
    request_adjustment: tPlan("requestAdjustment"),
    export_pdf: tPlan("exportPdf"),
    export_xlsx: tPlan("exportXlsx"),
  };
  return planLabels[id] ?? tDash("openPlan");
}

export default function PlanListPrimaryAction({ plan }: { plan: PlanListRow }) {
  const { user } = useAuth();
  const tPlan = useTranslations("plan");
  const tDash = useTranslations("dashboard");
  const role = planRoleFromUser(user?.role);
  const actions = getActions(plan.status as PlanStatus, role);
  const actionId =
    actions.primary ?? actions.secondary[0] ?? ("edit" as PlanActionId);
  const label = primaryLabel(actionId, tPlan, tDash);

  return (
    <Link href={`/plans/${plan.id}`} className={`${btnPrimary} shrink-0 text-center`}>
      {label}
    </Link>
  );
}
