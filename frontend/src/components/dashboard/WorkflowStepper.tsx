"use client";

import { useLocale } from "@/context/LocaleContext";

const STEPS = [
  { id: "DRAFT", key: "stepDraft" as const },
  { id: "UNDER_REVIEW", key: "stepReview" as const },
  { id: "ADJUSTMENT", key: "stepAdjust" as const },
  { id: "VALIDATED", key: "stepValidated" as const },
];

const ORDER = ["DRAFT", "UNDER_REVIEW", "ADJUSTMENT", "VALIDATED"];

function stepIndex(status: string): number {
  const i = ORDER.indexOf(status);
  return i >= 0 ? i : 0;
}

export default function WorkflowStepper({ status }: { status: string }) {
  const { t } = useLocale();
  const current = stepIndex(status);
  const progressPct = (current / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-navy-500/80">
        {t("workflow")}
      </p>
      <div className="relative">
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-navy-100" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
        <ol className="relative flex justify-between gap-1">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li
                key={step.id}
                className="flex flex-1 flex-col items-center text-center"
              >
                <span
                  className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-500 ${
                    active
                      ? "border-gold-500 bg-navy-800 text-gold-300 shadow-lg shadow-navy-900/20 scale-110"
                      : done
                        ? "border-gold-400 bg-gold-500 text-navy-900"
                        : "border-navy-200 bg-white text-navy-400"
                  }`}
                >
                  {done && !active ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`mt-2 hidden max-w-[4.5rem] text-[10px] font-medium leading-tight sm:block ${
                    active ? "text-navy-800" : "text-navy-500"
                  }`}
                >
                  {t(step.key)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
