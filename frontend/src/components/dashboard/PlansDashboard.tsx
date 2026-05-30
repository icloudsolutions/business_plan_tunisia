"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { DocumentPlusIcon } from "@heroicons/react/24/outline";
import { RefreshCw, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/ui/EmptyState";
import RoleGate from "@/components/auth/RoleGate";
import { useLocale } from "@/context/LocaleContext";
import { useDashboardNav } from "@/context/DashboardNavContext";
import { listPlans, type Plan } from "@/lib/api";
import PlanOverviewCard from "./PlanOverviewCard";
import PlansListTable from "./PlansListTable";
import { computePlanCompletion } from "@/lib/plan-completion";

type PlanWithMeta = Plan & { created_at?: string; updated_at?: string };

export default function PlansDashboard() {
  const { t } = useLocale();
  const tDash = useTranslations("dashboard");
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
        <RoleGate role={["client"]}>
          <Link
            href="/plans/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-md transition hover:bg-gold-400"
          >
            {t("newPlan")}
          </Link>
        </RoleGate>
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
          prefetch={false}
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
        <RoleGate
          role={["client"]}
          fallback={
            <EmptyState
              icon={<DocumentPlusIcon />}
              title={tDash("emptyPlansTitle")}
              description={tDash("emptyPlansDescription")}
            />
          }
        >
          <EmptyState
            icon={<DocumentPlusIcon />}
            title={tDash("emptyPlansTitle")}
            description={tDash("emptyPlansDescription")}
            cta={{ label: tDash("emptyPlansCta"), href: "/plans/new" }}
          />
        </RoleGate>
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
              <PlansListTable
                plans={plans.slice(1)}
                completionPct={(p) => computePlanCompletion(p).percent}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
