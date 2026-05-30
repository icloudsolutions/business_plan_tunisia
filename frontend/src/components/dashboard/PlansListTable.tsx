"use client";

import { Link } from "@/i18n/navigation";
import { useLocale as useIntlLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import WorkflowStepper from "@/components/plan/WorkflowStepper";
import { normalizeWorkflowRole } from "@/lib/plan-workflow";
import { useAuth } from "@/context/AuthContext";
import {
  getActions,
  planRoleFromUser,
  type PlanActionId,
  type PlanStatus,
} from "@/components/plan/getPlanActions";
import { btnPrimary } from "@/components/plan/plan-action-styles";
import type { Plan } from "@/lib/api";

export type PlanListRow = Plan & { created_at?: string; updated_at?: string };

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

function PlanListPrimaryAction({ plan }: { plan: PlanListRow }) {
  const { user } = useAuth();
  const tPlan = useTranslations("plan");
  const tDash = useTranslations("dashboard");
  const role = planRoleFromUser(user?.role);
  const actions = getActions(plan.status as PlanStatus, role);
  const actionId =
    actions.primary ?? actions.secondary[0] ?? ("edit" as PlanActionId);
  const label = primaryLabel(actionId, tPlan, tDash);

  return (
    <Link href={`/plans/${plan.id}`} className={`${btnPrimary} text-center`}>
      {label}
    </Link>
  );
}

function formatUpdated(
  plan: PlanListRow,
  locale: AppLocale,
  fallback: string
): string {
  const raw = plan.updated_at || plan.created_at;
  if (!raw) return fallback;
  return formatDate(raw, locale, { dateStyle: "medium", timeStyle: "short" });
}

type Props = {
  plans: PlanListRow[];
  completionPct: (plan: PlanListRow) => number;
};

export default function PlansListTable({ plans, completionPct }: Props) {
  const locale = useIntlLocale() as AppLocale;
  const tDash = useTranslations("dashboard");
  const { user } = useAuth();
  const workflowRole = normalizeWorkflowRole(user?.role);
  const unknownDate = "—";

  if (plans.length === 0) return null;

  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label={tDash("allPlans")}>
        {plans.map((plan) => (
          <li key={plan.id}>
            <div className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
              <p className="truncate font-semibold text-navy-900">{plan.title}</p>
              <div className="mt-3">
                <WorkflowStepper
                  status={plan.status}
                  role={workflowRole}
                  history={plan.history}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-navy-500">
                  <span className="font-medium text-navy-600">
                    {tDash("lastUpdated")}:
                  </span>{" "}
                  {formatUpdated(plan, locale, unknownDate)}
                </span>
              </div>
              <div className="mt-4">
                <PlanListPrimaryAction plan={plan} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-start text-xs font-semibold uppercase tracking-wide text-navy-500">
              <th className="px-4 py-3">{tDash("planName")}</th>
              <th className="px-4 py-3">{tDash("status")}</th>
              <th className="px-4 py-3">{tDash("lastUpdated")}</th>
              <th className="px-4 py-3 text-end">{tDash("completion")}</th>
              <th className="px-4 py-3 text-end">{tDash("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className="border-b border-navy-50 transition hover:bg-navy-50/50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/plans/${plan.id}`}
                    className="font-medium text-navy-800 hover:text-gold-700 hover:underline"
                  >
                    {plan.title}
                  </Link>
                </td>
                <td className="min-w-[280px] px-4 py-3">
                  <WorkflowStepper
                    status={plan.status}
                    role={workflowRole}
                    history={plan.history}
                    compact
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-navy-600">
                  {formatUpdated(plan, locale, unknownDate)}
                </td>
                <td className="px-4 py-3 text-end tabular-nums font-semibold text-navy-700">
                  {completionPct(plan)}%
                </td>
                <td className="px-4 py-3 text-end">
                  <PlanListPrimaryAction plan={plan} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
