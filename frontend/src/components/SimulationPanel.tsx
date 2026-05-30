"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SimulationItem } from "@/lib/api";
import { useFormat } from "@/hooks/useFormat";
import {
  formatDeltaTriPp,
  formatIrrRate,
  formatRunwayYear,
  formatVanDelta,
} from "@/lib/simulation-format";

/** Keep the latest simulation per scenario name (avoids duplicate rows). */
export function dedupeSimulationsByName(items: SimulationItem[]): SimulationItem[] {
  const byName = new Map<string, SimulationItem>();
  for (const s of items) {
    const prev = byName.get(s.name);
    if (!prev) {
      byName.set(s.name, s);
      continue;
    }
    const prevTs = prev.createdAt ?? "";
    const ts = s.createdAt ?? "";
    if (ts >= prevTs) byName.set(s.name, s);
  }
  return [...byName.values()].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}

type Props = {
  simulations: SimulationItem[];
};

export default function SimulationPanel({ simulations }: Props) {
  const t = useTranslations("simulation");
  const { formatNumber, locale } = useFormat();
  const rows = useMemo(() => dedupeSimulationsByName(simulations), [simulations]);
  const hiddenCount = simulations.length - rows.length;

  const fmtVan = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return formatNumber(n, { maximumFractionDigits: 0 });
  };

  if (!rows.length) {
    return (
      <p className="empty-state" style={{ padding: "0.5rem 0" }}>
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hiddenCount > 0 && (
        <p className="text-xs text-navy-500">
          {t("hiddenDuplicates", { count: hiddenCount })}
        </p>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("scenario")}</th>
              <th className="num">{t("vanBaseline")}</th>
              <th className="num">{t("vanScenario")}</th>
              <th className="num">{t("deltaVan")}</th>
              <th className="num">{t("triBaseline")}</th>
              <th className="num">{t("triScenario")}</th>
              <th className="num">{t("deltaTri")}</th>
              <th style={{ textAlign: "center" }}>{t("runwayBaseline")}</th>
              <th style={{ textAlign: "center" }}>{t("runwayScenario")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const d = s.deltaVsBaseline ?? {};
              const deltaVan = d.deltaVan;
              const deltaClass =
                typeof deltaVan === "number"
                  ? deltaVan < 0
                    ? "text-red-700"
                    : deltaVan > 0
                      ? "text-emerald-700"
                      : ""
                  : "";
              return (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="num tabular-nums">{fmtVan(d.baselineVan)}</td>
                  <td className="num tabular-nums">{fmtVan(d.scenarioVan)}</td>
                  <td className={`num tabular-nums font-semibold ${deltaClass}`}>
                    {formatVanDelta(deltaVan, locale)}
                  </td>
                  <td className="num tabular-nums">
                    {formatIrrRate(d.baselineTri ?? null, locale)}
                  </td>
                  <td className="num tabular-nums">
                    {formatIrrRate(d.scenarioTri ?? null, locale)}
                  </td>
                  <td className="num tabular-nums">
                    {formatDeltaTriPp(d.deltaTri, locale)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {formatRunwayYear(d.baselineCashBreakYear ?? null)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {formatRunwayYear(d.scenarioCashBreakYear ?? null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
