"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  adminAssignExpert,
  adminSetPlanStatus,
  listAdminPlans,
  listAdminUsers,
  type AdminPlan,
  type AdminUser,
} from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Expert</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Màj</TableHead>
                  <TableHead>Complétion</TableHead>
                  <TableHead>Export</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/plans/${p.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{p.owner_email}</TableCell>
                    <TableCell>
                      <select
                        className="max-w-[140px] rounded border border-slate-200 px-1 py-0.5 text-xs"
                        value={p.expert_id ?? ""}
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          await adminAssignExpert(p.id, e.target.value);
                          await load();
                        }}
                      >
                        <option value="">—</option>
                        {experts.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.email.split("@")[0]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <select
                        className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                        value={p.status}
                        onChange={async (e) => {
                          await adminSetPlanStatus(p.id, e.target.value);
                          await load();
                        }}
                      >
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(p.updated_at).toLocaleDateString("fr-TN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${p.completion_pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{p.completion_pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.export_status === "COMPLETED" ? "success" : "outline"}>
                        {p.export_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/finance/${p.id}`} className="text-xs text-blue-600">
                        Cockpit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
