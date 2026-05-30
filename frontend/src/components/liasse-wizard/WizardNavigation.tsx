"use client";

import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
} from "@/components/plan/plan-action-styles";

type Props = {
  stepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSaveExit: () => void;
  readOnly?: boolean;
  saving?: boolean;
};

/**
 * Wizard footer: one primary (Next / Finish), secondary (Back), ghost (Save draft).
 */
export default function WizardNavigation({
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  onSaveExit,
  readOnly,
  saving,
}: Props) {
  const t = useTranslations("wizard");
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-navy-100 pt-5 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pt-6">
      <button
        type="button"
        onClick={onSaveExit}
        disabled={saving}
        className={`${btnGhost} w-full sm:w-auto`}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {t("saveQuit")}
      </button>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst || readOnly}
          className={`${btnSecondary} flex-1 sm:flex-none`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("back")}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={readOnly && !isLast}
          className={`${btnPrimary} flex-1 sm:flex-none`}
        >
          {isLast ? t("finish") : t("next")}
          {!isLast && <ChevronRight className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
