"use client";

import { stepMetaFor } from "@/lib/liasse-wizard/field-meta";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/liasse-wizard/schema";

function shortTitle(title: string): string {
  if (title.length <= 14) return title;
  const first = title.split(/[\s&—-]/)[0];
  return first.length > 12 ? `${first.slice(0, 11)}…` : first;
}

type Props = {
  stepIndex: number;
  currentStep: WizardStepId;
  onGoTo: (index: number) => void;
};

export default function WizardMobileSteps({ stepIndex, currentStep, onGoTo }: Props) {
  const locale = useLocale() as AppLocale;
  const currentMeta = stepMetaFor(currentStep, locale);

  return (
    <div className="space-y-2 md:hidden">
      <label className="sr-only" htmlFor="wizard-step-select">
        Étape du parcours
      </label>
      <select
        id="wizard-step-select"
        className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm font-medium text-navy-800 sm:hidden"
        value={stepIndex}
        onChange={(e) => onGoTo(Number(e.target.value))}
      >
        {WIZARD_STEPS.map((id, i) => (
          <option key={id} value={i}>
            {i + 1}. {stepMetaFor(id, locale).title}
          </option>
        ))}
      </select>

      <div
        className="hidden gap-1.5 overflow-x-auto pb-1 sm:flex md:hidden"
        role="tablist"
        aria-label="Étapes"
      >
        {WIZARD_STEPS.map((id, i) => {
          const meta = stepMetaFor(id, locale);
          const active = i === stepIndex;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onGoTo(i)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-gold-500 text-white shadow-sm"
                  : "bg-navy-100 text-navy-600 hover:bg-navy-200/80"
              }`}
            >
              <span className="block tabular-nums">{i + 1}</span>
              <span className="mt-0.5 block max-w-[4.5rem] truncate text-[10px] font-normal opacity-90">
                {shortTitle(meta.title)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-navy-500 sm:hidden">
        {stepIndex + 1} / {WIZARD_STEPS.length} — {currentMeta.title}
      </p>
    </div>
  );
}
