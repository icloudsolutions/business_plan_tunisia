"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";
import WorkflowStepper from "@/components/plan/WorkflowStepper";
import { btnPrimary } from "@/components/plan/plan-action-styles";
import SortableTableHead from "@/components/dashboard/SortableTableHead";
import type { PlanSortKey, SortDirection } from "@/components/dashboard/plan-list-utils";
import type { AdminPlan } from "@/lib/admin-api";
import type { AdminUser } from "@/lib/admin-api";

const STATES = ["DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED"];

type AdminSortKey = PlanSortKey | "client" | "expert";

type Props = {
  plans: AdminPlan[];
  experts: AdminUser[];
  onAssignExpert: (planId: string, expertId: string) => Promise<void>;
  onSetStatus: (planId: string, status: string) => Promise<void>;
};

function sortAdminPlans(
  plans: AdminPlan[],
  key: AdminSortKey,
  direction: SortDirection
): AdminPlan[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...plans].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "title":
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        break;
      case "client":
        cmp = a.owner_email.localeCompare(b.owner_email, undefined, {
          sensitivity: "base",
        });
        break;
      case "expert":
        cmp = (a.expert_email ?? "").localeCompare(b.expert_email ?? "", undefined, {
          sensitivity: "base",
        });
        break;
      case "status":
        cmp =
          STATES.indexOf(a.status) - STATES.indexOf(b.status);
        break;
      case "updated":
        cmp = a.updated_at.localeCompare(b.updated_at);
        break;
      case "completion":
        cmp = a.completion_pct - b.completion_pct;
        break;
      default:
        cmp = 0;
    }
    return cmp * dir;
  });
}

function formatAdminDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-TN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPlansTable({
  plans,
  experts,
  onAssignExpert,
  onSetStatus,
}: Props) {
  const [sortKey, setSortKey] = useState<AdminSortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const handleSort = (key: string) => {
    const k = key as AdminSortKey;
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "title" || k === "client" ? "asc" : "desc");
    }
  };

  const sortedPlans = useMemo(
    () => sortAdminPlans(plans, sortKey, sortDir),
    [plans, sortKey, sortDir]
  );

  if (plans.length === 0) {
    return <p className="px-6 py-8 text-sm text-slate-500">Aucun plan.</p>;
  }

  return (
    <>
      <div className="space-y-3 p-4 md:hidden" aria-label="Liste des plans">
        {sortedPlans.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{p.title}</p>
                <p className="mt-0.5 truncate text-sm text-gray-500">{p.owner_email}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600">{formatAdminDate(p.updated_at)}</p>
              <Link
                href={`/plans/${p.id}`}
                className={`${btnPrimary} shrink-0 text-center`}
              >
                Ouvrir le plan
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[640px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold">
              <SortableTableHead
                label="Plan"
                sortKey="title"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                className="text-slate-500"
              />
              <SortableTableHead
                label="Client"
                sortKey="client"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                className="text-slate-500"
              />
              <SortableTableHead
                label="Expert"
                sortKey="expert"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                className="text-slate-500"
              />
              <SortableTableHead
                label="État"
                sortKey="status"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                className="text-slate-500"
              />
              <SortableTableHead
                label="Màj"
                sortKey="updated"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                className="text-slate-500"
              />
              <SortableTableHead
                label="Complétion"
                sortKey="completion"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                align="end"
                className="text-slate-500"
              />
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Export
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlans.map((p) => (
              <tr
                key={p.id}
                className="border-b border-slate-100 transition hover:bg-slate-50/80"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/plans/${p.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{p.owner_email}</td>
                <td className="px-4 py-3">
                  <select
                    className="max-w-[140px] rounded border border-slate-200 px-1 py-0.5 text-xs"
                    value={p.expert_id ?? ""}
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      await onAssignExpert(p.id, e.target.value);
                    }}
                  >
                    <option value="">—</option>
                    {experts.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.email.split("@")[0]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="min-w-[260px] space-y-2 px-4 py-3">
                  <WorkflowStepper status={p.status} role="admin" compact />
                  <select
                    className="w-full max-w-[160px] rounded border border-slate-200 px-1 py-0.5 text-xs"
                    value={p.status}
                    aria-label="Changer l'état"
                    onChange={async (e) => {
                      await onSetStatus(p.id, e.target.value);
                    }}
                  >
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                  {formatAdminDate(p.updated_at)}
                </td>
                <td className="px-4 py-3 text-end">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${p.completion_pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{p.completion_pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={p.export_status === "COMPLETED" ? "success" : "outline"}
                  >
                    {p.export_status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/finance/${p.id}`} className="text-xs text-blue-600">
                    Cockpit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
