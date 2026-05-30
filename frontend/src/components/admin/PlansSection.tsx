"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminAssignExpert,
  adminSetPlanStatus,
  listAdminPlans,
  listAdminUsers,
  type AdminPlan,
  type AdminUser,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminPlansTable from "./AdminPlansTable";

const STATES = ["DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED"];

export default function PlansSection() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [experts, setExperts] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState("");
  const [expertId, setExpertId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([
        listAdminPlans({
          status: status || undefined,
          expert_id: expertId || undefined,
          date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
        }),
        listAdminUsers(),
      ]);
      setPlans(p);
      setExperts(u.filter((x) => x.role === "expert"));
    } finally {
      setLoading(false);
    }
  }, [status, expertId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tous les états</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={expertId}
            onChange={(e) => setExpertId(e.target.value)}
          >
            <option value="">Tous les experts</option>
            {experts.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.email}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Button variant="outline" onClick={() => void load()}>
            Appliquer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans ({plans.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 py-8 text-sm text-slate-500">Chargement…</p>
          ) : (
            <AdminPlansTable
              plans={plans}
              experts={experts}
              onAssignExpert={async (planId, expertId) => {
                await adminAssignExpert(planId, expertId);
                await load();
              }}
              onSetStatus={async (planId, status) => {
                await adminSetPlanStatus(planId, status);
                await load();
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
