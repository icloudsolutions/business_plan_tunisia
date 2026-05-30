"use client";

import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3 } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { listPlans, type Plan } from "@/lib/api";

export default function FinanceHubPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-white">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-slate-900">
                Cockpit financier
              </h1>
              <p className="text-sm text-slate-600">
                Projections 7 ans live (P&L, trésorerie, VAN, TRI, DRCI)
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-500">
            Sélectionnez un business plan. L&apos;ancien module démo (coûts mock) reste
            disponible via le menu si besoin.
          </p>

          {loading ? (
            <p className="text-sm text-slate-500">Chargement…</p>
          ) : plans.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
              Aucun plan —{" "}
              <Link href="/" className="font-medium text-brand-600 hover:underline">
                créer un plan
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/finance/${p.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-brand-400 hover:shadow-md"
                  >
                    <span>
                      <span className="font-medium text-slate-900">{p.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{p.status}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 text-brand-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-slate-500 hover:text-brand-600">
              ← Retour aux plans TIA
            </Link>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
