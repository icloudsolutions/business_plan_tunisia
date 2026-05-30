"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale as useIntlLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import StatusBadge from "@/components/StatusBadge";
import WorkflowStepper from "@/components/plan/WorkflowStepper";
import { normalizeWorkflowRole } from "@/lib/plan-workflow";
import { useAuth } from "@/context/AuthContext";
import PlanListPrimaryAction from "./PlanListPrimaryAction";
import SortableTableHead from "./SortableTableHead";
import {
  planClientLabel,
  planUpdatedAt,
  sortPlanRows,
  type PlanListRow,
  type PlanSortKey,
  type SortDirection,
} from "./plan-list-utils";

type Props = {
  plans: PlanListRow[];
  completionPct: (plan: PlanListRow) => number;
};

function formatUpdated(
  plan: PlanListRow,
  locale: AppLocale,
  fallback: string
): string {
  const raw = planUpdatedAt(plan);
  if (!raw) return fallback;
  return formatDate(raw, locale, { dateStyle: "medium", timeStyle: "short" });
}

export default function PlansListTable({ plans, completionPct }: Props) {
  const locale = useIntlLocale() as AppLocale;
  const tDash = useTranslations("dashboard");
  const { user } = useAuth();
  const workflowRole = normalizeWorkflowRole(user?.role);
  const unknownDate = "—";

  const [sortKey, setSortKey] = useState<PlanSortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const handleSort = (key: string) => {
    const k = key as PlanSortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "title" ? "asc" : "desc");
    }
  };

  const sortedPlans = useMemo(
    () => sortPlanRows(plans, sortKey, sortDir, completionPct),
    [plans, sortKey, sortDir, completionPct]
  );

  if (plans.length === 0) return null;

  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden" aria-label={tDash("allPlans")}>
        {sortedPlans.map((plan) => {
          const client = planClientLabel(plan);
          return (
            <div
              key={plan.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{plan.title}</p>
                  {client ? (
                    <p className="mt-0.5 truncate text-sm text-gray-500">{client}</p>
                  ) : null}
                </div>
                <StatusBadge status={plan.status} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-600">
                  {formatUpdated(plan, locale, unknownDate)}
                </p>
                <PlanListPrimaryAction plan={plan} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: sortable table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[640px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs font-semibold">
              <SortableTableHead
                label={tDash("planName")}
                sortKey="title"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTableHead
                label={tDash("status")}
                sortKey="status"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTableHead
                label={tDash("lastUpdated")}
                sortKey="updated"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortableTableHead
                label={tDash("completion")}
                sortKey="completion"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                align="end"
              />
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-navy-500">
                {tDash("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlans.map((plan) => (
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
                  {planClientLabel(plan) ? (
                    <p className="mt-0.5 text-xs text-navy-500">
                      {planClientLabel(plan)}
                    </p>
                  ) : null}
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
