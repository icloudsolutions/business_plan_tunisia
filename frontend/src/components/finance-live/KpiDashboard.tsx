"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, HelpCircle, Loader2, XCircle } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat } from "@/hooks/useFormat";
import { fetchKpiDashboard, type KpiDashboardProjection } from "@/lib/finance/kpi-api";

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

function HeroCard({
  label,
  value,
  hint,
  statusClass,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string;
  statusClass?: string;
  tooltip?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${statusClass ?? "border-slate-200 bg-white"}`}
    >
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        {tooltip && (
          <span className="group relative">
            <HelpCircle className="h-3.5 w-3.5 opacity-60" aria-hidden />
            <span className="pointer-events-none absolute start-0 top-full z-10 mt-1 hidden w-52 rounded bg-slate-800 px-2 py-1.5 text-xs font-normal text-white group-hover:block">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-75">{hint}</p>}
    </div>
  );
}

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
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Calcul des indicateurs…
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <HeroCard
          label="VAN (NPV)"
          value={formatCurrency(p.van)}
          tooltip={`Actualisation au taux de ${(p.discount_rate * 100).toFixed(0)} % (hypothèse Excel / paramètre plan). Flux : investissement initial puis CF nets annuels.`}
          statusClass={vanStyle}
          hint={`Taux ${(p.discount_rate * 100).toFixed(0)} %`}
        />
        <HeroCard
          label="TRI (IRR)"
          value={p.tri != null ? formatPercent(p.tri) : "—"}
          statusClass={triStyle}
          hint={
            data.tri_status === "green"
              ? "> 15 %"
              : data.tri_status === "orange"
                ? "10–15 %"
                : "< 10 %"
          }
        />
        <HeroCard
          label="DRCI"
          value={p.drci_label}
          hint="Délai de récupération de l'investissement"
        />
        <HeroCard
          label="IP"
          value={p.profitability_index != null ? p.profitability_index.toFixed(2) : "—"}
          hint="VAN / investissement initial"
        />
        <HeroCard
          label="TRC"
          value={p.trc != null ? formatPercent(p.trc) : "—"}
          hint="Résultat net moyen / investissement"
        />
      </section>

      <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <strong>Point mort — </strong>
        {data.capacity.break_even_callout}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="CA &amp; résultats (Y1–Y7)" subtitle="CA net, EBIT et résultat net">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chart_revenue_profit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={72} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={72} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
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
        </ChartPanel>

        <ChartPanel title="Marges (%)" subtitle="Marge brute et marge nette par année">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart_margins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" width={48} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)} %`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="grossMarginPct" name="Marge brute" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="netMarginPct" name="Marge nette" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Utilisation capacité" subtitle="% de la capacité nominale">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.chart_capacity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, "auto"]} width={48} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)} %`} />
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
        </ChartPanel>

        <ChartPanel
          title="Couverture dette"
          subtitle="EBE vs. service de la dette (intérêts + principal)"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart_debt_coverage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={72} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ebitda" name="EBE" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="debtService" name="Service dette" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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

      <section className="grid gap-4 sm:grid-cols-3">
        {data.financing.map((f) => (
          <div
            key={f.year}
            className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs"
          >
            <p className="font-semibold text-slate-700">Y{f.year}</p>
            <p className="mt-1 text-slate-600">
              Endettement : {(f.debt_ratio * 100).toFixed(0)} %
            </p>
            <p className="text-slate-600">
              DSCR : {f.dscr != null ? f.dscr.toFixed(2) : "—"}
            </p>
            <p className="text-slate-600">CRD : {formatCurrency(f.remaining_debt)}</p>
          </div>
        ))}
      </section>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mb-3 text-xs text-slate-500">{subtitle}</p>
      {children}
    </div>
  );
}
