"use client";

import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, FileBarChart } from "lucide-react";
import ChartLtr from "@/components/ui/ChartLtr";
import ChartSuspense from "@/components/ui/ChartSuspense";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/lib/recharts-dynamic";
import { useFormat } from "@/hooks/useFormat";
import { isApiHttpError } from "@/lib/api-errors";
import { listPlans, type Plan } from "@/lib/api";
import {
  fetchKpiDashboard,
  type KpiDashboardProjection,
} from "@/lib/finance/kpi-api";
import ChartBarsSkeleton from "./ChartBarsSkeleton";

type LoadState = "loading" | "ready" | "empty" | "error";

function pickValidatedPlan(plans: Plan[], preferredId?: string | null): Plan | null {
  const validated = plans.filter((p) => p.status === "VALIDATED");
  if (preferredId) {
    const match = validated.find((p) => p.id === preferredId);
    if (match) return match;
  }
  return validated[0] ?? null;
}

export default function FinanceKpiCockpit({
  preferredPlanId,
}: {
  preferredPlanId?: string | null;
}) {
  const t = useTranslations("finance");
  const { formatCurrency } = useFormat();
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [kpis, setKpis] = useState<KpiDashboardProjection | null>(null);
  const [validatedPlans, setValidatedPlans] = useState<Plan[]>([]);

  const load = useCallback(async () => {
    setState("loading");
    setErrorMsg("");
    setKpis(null);
    try {
      const plans = await listPlans();
      const validated = plans.filter((p) => p.status === "VALIDATED");
      setValidatedPlans(validated);
      const selected = pickValidatedPlan(plans, preferredPlanId);
      if (!selected) {
        setPlan(null);
        setState("empty");
        return;
      }
      setPlan(selected);
      try {
        const data = await fetchKpiDashboard(selected.id, "base");
        setKpis(data);
        setState("ready");
      } catch (e) {
        if (isApiHttpError(e, 404)) {
          setState("empty");
          return;
        }
        throw e;
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur");
      setState("error");
    }
  }, [preferredPlanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPlanChange = async (planId: string) => {
    const next = validatedPlans.find((p) => p.id === planId);
    if (!next) return;
    setPlan(next);
    setState("loading");
    setKpis(null);
    try {
      setKpis(await fetchKpiDashboard(planId, "base"));
      setState("ready");
    } catch (e) {
      if (isApiHttpError(e, 404)) {
        setState("empty");
      } else {
        setErrorMsg(e instanceof Error ? e.message : "Erreur");
        setState("error");
      }
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-white">
          <BarChart3 className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            {t("cockpitTitle")}
          </h1>
          <p className="text-sm text-slate-600">{t("cockpitSubtitle")}</p>
        </div>
        {validatedPlans.length > 1 && state === "ready" && plan && (
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={plan.id}
            onChange={(e) => void onPlanChange(e.target.value)}
          >
            {validatedPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {state === "loading" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {t("chartRevenueTitle")}
            </h2>
            <ChartBarsSkeleton />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {t("chartMarginsTitle")}
            </h2>
            <ChartBarsSkeleton />
          </section>
        </div>
      )}

      {state === "empty" && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div
            className="mb-6 flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
            aria-hidden
          >
            <FileBarChart className="h-14 w-14 stroke-[1.25]" />
          </div>
          <p className="max-w-md text-base text-slate-700">{t("emptyValidated")}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            {t("emptyValidatedCta")}
          </Link>
        </div>
      )}

      {state === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</p>
      )}

      {state === "ready" && kpis && (
        <div className="space-y-6">
          {plan && (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{plan.title}</span>
              {" · "}
              <Link
                href={`/finance/${plan.id}`}
                prefetch={false}
                className="font-medium text-brand-600 hover:underline"
              >
                {t("openFullCockpit")}
              </Link>
            </p>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">{t("chartRevenueTitle")}</h2>
              <p className="mb-3 text-xs text-slate-500">{t("chartRevenueSubtitle")}</p>
              <ChartSuspense>
                <div className="h-64">
                  <ChartLtr className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kpis.chart_revenue_profit}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} width={72} />
                        <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="revenue"
                          name={t("legendRevenue")}
                          fill="#4f46e5"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartLtr>
                </div>
              </ChartSuspense>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">{t("chartMarginsTitle")}</h2>
              <p className="mb-3 text-xs text-slate-500">{t("chartMarginsSubtitle")}</p>
              <ChartSuspense>
                <div className="h-64">
                  <ChartLtr className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={kpis.chart_margins}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" width={48} />
                        <Tooltip formatter={(value: number | string) => `${Number(value).toFixed(1)} %`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line
                          type="monotone"
                          dataKey="grossMarginPct"
                          name={t("legendGrossMargin")}
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="netMarginPct"
                          name={t("legendNetMargin")}
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartLtr>
                </div>
              </ChartSuspense>
            </section>
          </div>
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="text-sm text-slate-500 hover:text-brand-600">
          {t("backToPlans")}
        </Link>
      </div>
    </div>
  );
}
