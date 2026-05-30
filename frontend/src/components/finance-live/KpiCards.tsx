"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import KpiSummaryGrid from "@/components/dashboard/KpiSummaryGrid";
import { formatPct, formatTnd, type ProjectionPayload } from "@/lib/finance/projections-api";

function Trend({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value)) {
    return <Minus className="h-8 w-8 text-slate-400 sm:h-10 sm:w-10" aria-hidden />;
  }
  if (value > 0.005) {
    return <ArrowUp className="h-8 w-8 text-emerald-600 sm:h-10 sm:w-10" aria-hidden />;
  }
  if (value < -0.005) {
    return <ArrowDown className="h-8 w-8 text-red-600 sm:h-10 sm:w-10" aria-hidden />;
  }
  return <Minus className="h-8 w-8 text-slate-400 sm:h-10 sm:w-10" aria-hidden />;
}

const CARDS: {
  key: keyof ProjectionPayload["kpis"];
  trendKey: string;
  label: string;
  format: (v: number | null) => string;
}[] = [
  { key: "van", trendKey: "van", label: "VAN", format: (v) => formatTnd(v ?? 0) },
  {
    key: "tri",
    trendKey: "tri",
    label: "TRI",
    format: (v) => formatPct(v ?? null),
  },
  {
    key: "drci",
    trendKey: "drci",
    label: "DRCI (ans)",
    format: (v) => (v != null ? `${v.toFixed(1)} ans` : "—"),
  },
  {
    key: "pointMort",
    trendKey: "pointMort",
    label: "Point mort",
    format: (v) => (v != null ? `An ${v}` : "—"),
  },
  {
    key: "grossMarginPct",
    trendKey: "grossMarginPct",
    label: "Marge brute (An 1)",
    format: (v) => formatPct(v ?? 0),
  },
  { key: "ebe", trendKey: "ebe", label: "EBE (An 1)", format: (v) => formatTnd(v ?? 0) },
];

export default function KpiCards({ data }: { data: ProjectionPayload }) {
  const { kpis } = data;
  return (
    <KpiSummaryGrid>
      {CARDS.map(({ key, trendKey, label, format }) => {
        const val = kpis[key] as number | null;
        const trend = kpis.trends?.[trendKey];
        return (
          <DashboardKpiCard
            key={String(key)}
            label={label}
            value={format(val)}
            icon={<Trend value={trend} />}
            hint={
              trend != null && !Number.isNaN(trend)
                ? `${(trend * 100).toFixed(0)} % vs scénario`
                : undefined
            }
          />
        );
      })}
    </KpiSummaryGrid>
  );
}
