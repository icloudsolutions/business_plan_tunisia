"use client";

import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Plus, RefreshCw, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useDashboardNav } from "@/context/DashboardNavContext";
import {
  createPlan,
  listPlans,
  type Plan,
} from "@/lib/api";
import PlanOverviewCard from "./PlanOverviewCard";
import { computePlanCompletion } from "@/lib/plan-completion";

type PlanWithMeta = Plan & { created_at?: string; updated_at?: string };

export default function PlansDashboard() {
  const router = useRouter();
  const { isExpert, isClient } = useAuth();
  const { t } = useLocale();
  const { setPlanTitle } = useDashboardNav();
  const [plans, setPlans] = useState<PlanWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlans = useCallback(async () => {
    setError("");
    try {
      const data = (await listPlans()) as PlanWithMeta[];
      data.sort((a, b) => {
        const ta = a.updated_at || a.created_at || "";
        const tb = b.updated_at || b.created_at || "";
        return tb.localeCompare(ta);
      });
      setPlans(data);
      if (data.length > 0) setPlanTitle(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [setPlanTitle]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const newPlan = async () => {
    const p = await createPlan(
      "Business Plan " + new Date().toLocaleDateString("fr-TN")
    );
    router.push(`/plans/${p.id}`);
  };

  const featured = plans[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-navy-800 sm:text-4xl">
          {t("dashboardTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-navy-600 sm:text-base">
          {t("dashboardSubtitle")}
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-3">
        {isClient && (
          <button
            type="button"
            onClick={newPlan}
            className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-md transition hover:bg-gold-400"
          >
            <Plus className="h-4 w-4" />
            {t("newPlan")}
          </button>
        )}
        <button
          type="button"
          onClick={loadPlans}
          className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t("refresh")}
        </button>
        <Link
          href="/finance"
          className="inline-flex items-center gap-2 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:border-gold-400"
        >
          {t("financeCta")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-navy-200 border-t-gold-500" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-200 bg-white/80 p-12 text-center">
          <p className="text-navy-600">{t("noPlans")}</p>
          {isClient && (
            <button
              type="button"
              onClick={newPlan}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy-800 px-6 py-3 text-sm font-semibold text-gold-300"
            >
              <Plus className="h-4 w-4" />
              {t("createFirst")}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {featured && (
            <PlanOverviewCard
              plan={featured}
              createdAt={featured.created_at}
              onRefresh={loadPlans}
            />
          )}

          {plans.length > 1 && (
            <section>
              <h3 className="mb-4 font-display text-lg font-semibold text-navy-800">
                {t("allPlans")}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {plans.slice(1).map((p) => {
                  const { percent } = computePlanCompletion(p);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/plans/${p.id}`}
                        className="flex items-center justify-between rounded-xl border border-navy-100 bg-white p-4 transition hover:border-gold-400 hover:shadow-md"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy-800">{p.title}</p>
                          <p className="mt-1 text-xs text-navy-500">{p.status}</p>
                        </div>
                        <span className="ml-3 shrink-0 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">
                          {percent}%
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
