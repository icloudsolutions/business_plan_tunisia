"use client";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import WorkflowStepper from "@/components/plan/WorkflowStepper";
import { btnPrimary } from "@/components/plan/plan-action-styles";
import type { AdminPlan } from "@/lib/admin-api";
import type { AdminUser } from "@/lib/admin-api";

const STATES = ["DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED"];

type Props = {
  plans: AdminPlan[];
  experts: AdminUser[];
  onAssignExpert: (planId: string, expertId: string) => Promise<void>;
  onSetStatus: (planId: string, status: string) => Promise<void>;
};

export default function AdminPlansTable({
  plans,
  experts,
  onAssignExpert,
  onSetStatus,
}: Props) {
  if (plans.length === 0) {
    return <p className="px-6 py-8 text-sm text-slate-500">Aucun plan.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {plans.map((p) => (
          <li key={p.id} className="space-y-3 px-4 py-4">
            <p className="truncate font-semibold text-slate-900">{p.title}</p>
            <WorkflowStepper status={p.status} role="admin" compact />
            <span className="text-xs text-slate-500">
              Màj {new Date(p.updated_at).toLocaleDateString("fr-TN")}
            </span>
            <Link href={`/plans/${p.id}`} className={`${btnPrimary} w-full text-center`}>
              Ouvrir le plan
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-start text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Expert</th>
              <th className="px-4 py-3">État</th>
              <th className="px-4 py-3">Màj</th>
              <th className="px-4 py-3">Complétion</th>
              <th className="px-4 py-3">Export</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
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
                  {new Date(p.updated_at).toLocaleDateString("fr-TN")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
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
