"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { FinancingStructureProjection } from "@/lib/financing-structure-api";

type Props = {
  projection: FinancingStructureProjection | null;
};

export default function FinancingEligibilityChecker({ projection }: Props) {
  const programs = projection?.eligibility_programs ?? [];
  const indicators = projection?.indicators ?? {};

  if (!programs.length) return null;

  return (
    <section className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm">
      <h4 className="mb-1 text-sm font-semibold text-navy-800">
        Éligibilité aux dispositifs tunisiens
      </h4>
      <p className="mb-3 text-xs text-navy-500">
        Estimation selon la structure de financement et les indicateurs projet (VAN, TRI, DRCI).
      </p>
      {(indicators.van != null || indicators.tri != null) && (
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-navy-600">
          {indicators.van != null && (
            <span>
              VAN :{" "}
              <strong className={indicators.van > 0 ? "text-green-700" : "text-red-700"}>
                {Math.round(indicators.van).toLocaleString("fr-TN")} TND
              </strong>
            </span>
          )}
          {indicators.tri != null && (
            <span>
              TRI : <strong>{(indicators.tri * 100).toFixed(1)} %</strong>
            </span>
          )}
          {indicators.drci_years != null && (
            <span>
              DRCI : <strong>{indicators.drci_years.toFixed(1)} ans</strong>
            </span>
          )}
        </div>
      )}
      <ul className="space-y-3">
        {programs.map((p) => (
          <li
            key={p.key}
            className={`rounded-lg border p-3 ${
              p.eligible ? "border-green-200 bg-green-50/40" : "border-navy-100 bg-navy-50/30"
            }`}
          >
            <div className="flex items-start gap-2">
              {p.eligible ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-900">
                  {p.name}
                  <span
                    className={`ms-2 text-xs font-normal ${
                      p.eligible ? "text-green-700" : "text-navy-500"
                    }`}
                  >
                    {p.eligible ? "Éligible" : "Non éligible"}
                  </span>
                </p>
                <p className="text-xs text-navy-600">{p.description}</p>
                <ul className="mt-1.5 list-inside list-disc text-xs text-navy-500">
                  {p.criteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {p.reasons.length > 0 && (
                  <p className="mt-1 text-xs text-amber-800">
                    {p.reasons.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
