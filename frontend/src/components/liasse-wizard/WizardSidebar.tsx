"use client";

import { AlertTriangle } from "lucide-react";
import { stepMetaFor } from "@/lib/liasse-wizard/field-meta";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { ConsistencyAlert } from "@/lib/liasse-wizard/consistency";
import type { WizardTotals } from "@/lib/liasse-wizard/totals";
import SectionCompletionChip from "@/components/completion/SectionCompletionChip";
import { sectionById, type PlanCompletion } from "@/lib/completion";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";

const STEP_ORDER: WizardStepId[] = [
  "general",
  "investments",
  "financing",
  "operations",
  "products",
  "productionCosts",
  "hr",
  "financial",
];

type Props = {
  currentStep: WizardStepId;
  onStepClick: (step: WizardStepId) => void;
  totals: WizardTotals;
  alerts: ConsistencyAlert[];
  readOnly?: boolean;
  completion?: PlanCompletion | null;
};

function fmt(n: number) {
  return n.toLocaleString("fr-TN", { maximumFractionDigits: 0 });
}

export default function WizardSidebar({
  currentStep,
  onStepClick,
  totals,
  alerts,
  readOnly,
  completion,
}: Props) {
  const locale = useLocale() as AppLocale;
  return (
    <aside className="sticky top-24 hidden w-64 shrink-0 flex-col gap-6 lg:flex">
      <nav aria-label="Étapes du formulaire">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
          Parcours
        </p>
        <ol className="space-y-1">
          {STEP_ORDER.map((id, index) => {
            const active = id === currentStep;
            const meta = stepMetaFor(id, locale);
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={readOnly && !active}
                  onClick={() => onStepClick(id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                    active
                      ? "bg-gold-50 font-semibold text-navy-900 ring-1 ring-gold-200"
                      : "text-navy-600 hover:bg-navy-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      active ? "bg-gold-500 text-white" : "bg-navy-100 text-navy-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{meta.title}</span>
                  <SectionCompletionChip section={sectionById(completion ?? null, id)} />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
          Totaux en direct
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-navy-600">Total investissement</dt>
            <dd className="font-semibold tabular-nums text-navy-900">
              {fmt(totals.totalInvestissement)} TND
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-navy-600">Capital propre</dt>
            <dd className="font-semibold tabular-nums text-gold-700">
              {fmt(totals.capitalPropre)} TND
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-navy-600">Emprunt estimé</dt>
            <dd className="tabular-nums text-navy-800">{fmt(totals.empruntEstime)} TND</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-navy-600">Masse salariale</dt>
            <dd className="tabular-nums text-navy-800">{fmt(totals.masseSalariale)} TND</dd>
          </div>
        </dl>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Cohérence
          </p>
          <ul className="space-y-2 text-xs text-amber-900">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={a.severity === "error" ? "font-medium text-red-800" : ""}
              >
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
