"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, HelpCircle, Loader2, XCircle } from "lucide-react";
import ChartLtr from "@/components/ui/ChartLtr";
import ChartSuspense from "@/components/ui/ChartSuspense";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/lib/recharts-dynamic";
import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import KpiSummaryGrid from "@/components/dashboard/KpiSummaryGrid";
import { useFormat } from "@/hooks/useFormat";
import { fetchKpiDashboard, type KpiDashboardProjection } from "@/lib/finance/kpi-api";
import ChartBarsSkeleton from "./ChartBarsSkeleton";

type Props = {
  planId: string;
  scenario?: "base" | "pessimistic" | "optimistic";
};

const TRI_STYLES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  orange: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
};

export default function KpiDashboard({ planId, scenario = "base" }: Props) {
  const tFinance = useTranslations("finance");
  const { formatCurrency, formatPercent } = useFormat();
  const [data, setData] = useState<KpiDashboardProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchKpiDashboard(planId, scenario));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement indicateurs");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [planId, scenario]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBarsSkeleton />
        <ChartBarsSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
        {error || tFinance("kpiUnavailable")}
      </p>
    );
  }

  const p = data.primary;
  const triStyle = TRI_STYLES[data.tri_status] ?? TRI_STYLES.neutral;
  const vanStyle =
    p.van >= 0
      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
      : "border-red-200 bg-gradient-to-br from-red-50 to-white";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Synthèse financière</h2>
          <p className="text-sm text-slate-500">
            Indicateurs d&apos;investissement et de performance · scénario {scenario}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            data.financability.is_financable
              ? "bg-emerald-100 text-emerald-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {data.financability.is_financable ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {data.financability.label}
        </span>
      </div>

      <KpiSummaryGrid>
        <DashboardKpiCard
          label="VAN (NPV)"
          value={formatCurrency(p.van)}
          hint={`Taux ${(p.discount_rate * 100).toFixed(0)} %`}
          className={vanStyle}
          labelAdornment={
            <span className="group relative shrink-0">
              <HelpCircle className="h-8 w-8 text-slate-500 opacity-60 sm:h-10 sm:w-10" aria-hidden />
              <span className="pointer-events-none absolute start-0 top-full z-10 mt-1 hidden w-52 rounded bg-slate-800 px-2 py-1.5 text-xs font-normal text-white group-hover:block">
                Actualisation au taux de {(p.discount_rate * 100).toFixed(0)} % (hypothèse Excel /
                paramètre plan). Flux : investissement initial puis CF nets annuels.
              </span>
            </span>
          }
        />
        <DashboardKpiCard
          label="TRI (IRR)"
          value={p.tri != null ? formatPercent(p.tri) : "—"}
          className={triStyle}
          hint={
            data.tri_status === "green"
              ? "> 15 %"
              : data.tri_status === "orange"
                ? "10–15 %"
                : "< 10 %"
          }
        />
        <DashboardKpiCard
          label="DRCI"
          value={p.drci_label}
          hint="Délai de récupération de l'investissement"
        />
        <DashboardKpiCard
          label="IP"
          value={p.profitability_index != null ? p.profitability_index.toFixed(2) : "—"}
          hint="VAN / investissement initial"
        />
        <DashboardKpiCard
          label="TRC"
          value={p.trc != null ? formatPercent(p.trc) : "—"}
          hint="Résultat net moyen / investissement"
        />
      </KpiSummaryGrid>

      <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <strong>Point mort — </strong>
        {data.capacity.break_even_callout}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="CA &amp; résultats (Y1–Y7)" subtitle="CA net, EBIT et résultat net">
          <ChartSuspense>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.chart_revenue_profit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={72} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={72} />
                  <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="revenue" name="CA net" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="ebit"
                    name="EBIT"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="netProfit"
                    name="Résultat net"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartSuspense>
        </ChartPanel>

        <ChartPanel title="Marges (%)" subtitle="Marge brute et marge nette par année">
          <ChartSuspense>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart_margins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" width={48} />
                  <Tooltip formatter={(value: number | string) => `${Number(value).toFixed(1)} %`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="grossMarginPct" name="Marge brute" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="netMarginPct" name="Marge nette" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartSuspense>
        </ChartPanel>

        <ChartPanel title="Utilisation capacité" subtitle="% de la capacité nominale">
          <ChartSuspense>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.chart_capacity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, "auto"]} width={48} />
                  <Tooltip formatter={(value: number | string) => `${Number(value).toFixed(1)} %`} />
                  <Area
                    type="monotone"
                    dataKey="utilization"
                    name="Taux d'utilisation"
                    fill="#10b981"
                    stroke="#059669"
                    fillOpacity={0.4}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartSuspense>
        </ChartPanel>

        <ChartPanel
          title="Couverture dette"
          subtitle="EBE vs. service de la dette (intérêts + principal)"
        >
          <ChartSuspense>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart_debt_coverage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} width={72} />
                  <Tooltip formatter={(value: number | string) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ebitda" name="EBE" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="debtService" name="Service dette" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartSuspense>
        </ChartPanel>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Performance annuelle</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-2 py-2 text-start">Indicateur</th>
                {data.annual_performance.map((r) => (
                  <th key={r.year} className="px-2 py-2 text-end">
                    Y{r.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-slate-800">
              {[
                { label: "CA net", key: "revenue" as const, fmt: formatCurrency },
                { label: "EBIT", key: "ebit" as const, fmt: formatCurrency },
                { label: "Résultat net", key: "net_profit" as const, fmt: formatCurrency },
                { label: "EBE", key: "ebe" as const, fmt: formatCurrency },
                {
                  label: "Marge brute %",
                  key: "gross_margin_pct" as const,
                  fmt: (v: number) => formatPercent(v),
                },
                {
                  label: "Marge nette %",
                  key: "net_margin_pct" as const,
                  fmt: (v: number) => formatPercent(v),
                },
              ].map((row) => (
                <tr key={row.label} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 font-medium">{row.label}</td>
                  {data.annual_performance.map((y) => (
                    <td key={`${row.label}-${y.year}`} className="px-2 py-1.5 text-end">
                      {row.fmt(y[row.key] as number)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <KpiSummaryGrid className="lg:grid-cols-3 xl:grid-cols-4">
        {data.financing.map((f) => (
          <DashboardKpiCard
            key={f.year}
            label={`Y${f.year}`}
            value={`DSCR ${f.dscr != null ? f.dscr.toFixed(2) : "—"}`}
            hint={`Endettement ${(f.debt_ratio * 100).toFixed(0)} % · CRD ${formatCurrency(f.remaining_debt)}`}
            className="border-slate-100 bg-slate-50/50"
          />
        ))}
      </KpiSummaryGrid>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="truncate text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mb-3 truncate text-xs text-slate-500">{subtitle}</p>
      <ChartLtr className="min-h-0 overflow-hidden">{children}</ChartLtr>
    </div>
  );
}
