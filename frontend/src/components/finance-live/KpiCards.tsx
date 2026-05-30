"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatPct, formatTnd, type ProjectionPayload } from "@/lib/finance/projections-api";

function Trend({ value }: { value: number | null | undefined }) {
  if (value == null || Number.isNaN(value)) {
    return <Minus className="h-4 w-4 text-slate-400" aria-hidden />;
  }
  if (value > 0.005) return <ArrowUp className="h-4 w-4 text-emerald-600" />;
  if (value < -0.005) return <ArrowDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {CARDS.map(({ key, trendKey, label, format }) => {
        const val = kpis[key] as number | null;
        const trend = kpis.trends?.[trendKey];
        return (
          <div
            key={String(key)}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="font-display text-2xl font-semibold tabular-nums text-slate-900">
                {format(val)}
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Trend value={trend} />
                {trend != null && !Number.isNaN(trend) && (
                  <span>{(trend * 100).toFixed(0)} %</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
