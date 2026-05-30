"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart3 } from "lucide-react";
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
import { useFinanceCockpitKpis } from "@/hooks/useFinanceCockpitKpis";

function ChartAreaSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
}

export default function FinanceKpiCockpit({
  preferredPlanId,
}: {
  preferredPlanId?: string | null;
}) {
  const t = useTranslations("finance");
  const { formatCurrency } = useFormat();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const {
    plan,
    validatedPlans,
    kpis,
    isLoading,
    isEmpty,
    error,
  } = useFinanceCockpitKpis(selectedPlanId ?? preferredPlanId);

  const showCharts = !isLoading && !isEmpty && !error && kpis && plan;

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
        {validatedPlans.length > 1 && showCharts && plan && (
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={plan.id}
            onChange={(e) => setSelectedPlanId(e.target.value)}
          >
            {validatedPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {t("chartRevenueTitle")}
            </h2>
            <ChartAreaSkeleton />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">
              {t("chartMarginsTitle")}
            </h2>
            <ChartAreaSkeleton />
          </section>
        </div>
      )}

      {isEmpty && !isLoading && (
        <EmptyState
          icon={<ChartBarIcon aria-hidden />}
          title={t("emptyNoDataTitle")}
          description={t("emptyNoDataSubtitle")}
          cta={{ label: t("emptyNoDataCta"), href: "/plans" }}
        />
      )}

      {error && !isLoading && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error.message}
        </p>
      )}

      {showCharts && (
        <div className="space-y-6">
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
            <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="truncate text-sm font-semibold text-slate-800">
                {t("chartRevenueTitle")}
              </h2>
              <p className="mb-3 truncate text-xs text-slate-500">
                {t("chartRevenueSubtitle")}
              </p>
              <ChartSuspense>
                <div className="h-64 min-h-0">
                  <ChartLtr className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kpis.chart_revenue_profit}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} width={72} />
                        <Tooltip
                          formatter={(value: number | string) =>
                            formatCurrency(Number(value))
                          }
                        />
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

            <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="truncate text-sm font-semibold text-slate-800">
                {t("chartMarginsTitle")}
              </h2>
              <p className="mb-3 truncate text-xs text-slate-500">
                {t("chartMarginsSubtitle")}
              </p>
              <ChartSuspense>
                <div className="h-64 min-h-0">
                  <ChartLtr className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={kpis.chart_margins}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" width={48} />
                        <Tooltip
                          formatter={(value: number | string) =>
                            `${Number(value).toFixed(1)} %`
                          }
                        />
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
