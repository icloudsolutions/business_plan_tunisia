"use client";

import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";

type Props = {
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSaveExit: () => void;
  readOnly?: boolean;
  saving?: boolean;
};

export default function WizardNavigation({
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  onSaveExit,
  readOnly,
  saving,
}: Props) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-6">
      <button
        type="button"
        onClick={onSaveExit}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Enregistrer et quitter
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst || readOnly}
          className="inline-flex items-center gap-1 rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={readOnly && !isLast}
          className="inline-flex items-center gap-1 rounded-lg bg-navy-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          {isLast ? "Terminer la saisie" : "Suivant"}
          {!isLast && <ChevronRight className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
