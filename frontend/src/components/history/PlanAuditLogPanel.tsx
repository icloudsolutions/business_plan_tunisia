"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listPlanAuditLog, type AuditLogEntry } from "@/lib/history-api";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-TN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncate(val: string | null, max = 80): string {
  if (val == null || val === "") return "—";
  if (val.length <= max) return val;
  return `${val.slice(0, max)}…`;
}

type Props = {
  planId: string;
  active: boolean;
};

export default function PlanAuditLogPanel({ planId, active }: Props) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await listPlanAuditLog(planId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-navy-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-6 text-sm text-red-600">
        {error}
        <button type="button" className="ms-2 underline" onClick={() => void load()}>
          Réessayer
        </button>
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-navy-500">
        Aucune modification enregistrée pour ce dossier.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      <p className="mb-3 text-xs text-navy-500">
        Journal champ par champ — utile pour voir ce que le client a modifié entre deux
        soumissions.
      </p>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className="rounded-lg border border-navy-100 bg-white p-3 text-xs shadow-sm"
          >
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] text-navy-800">
                {e.field_path}
              </code>
              <time className="shrink-0 text-[10px] text-navy-500">{formatTime(e.changed_at)}</time>
            </div>
            <p className="mb-2 text-[10px] text-navy-500">{e.user_email ?? "Utilisateur"}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-[10px] font-semibold uppercase text-navy-400">Avant</span>
                <p className="mt-0.5 break-all text-navy-700">{truncate(e.old_value)}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-navy-400">Après</span>
                <p className="mt-0.5 break-all font-medium text-navy-900">
                  {truncate(e.new_value)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
