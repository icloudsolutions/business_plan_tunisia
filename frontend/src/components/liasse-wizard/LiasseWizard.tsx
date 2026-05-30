"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Inputs } from "@/components/liasse-form-utils";
import { inputsToFormValues } from "@/lib/liasse-wizard/defaults";
import {
  buildPreflightReport,
  getConsistencyAlerts,
} from "@/lib/liasse-wizard/consistency";
import { stepMetaFor } from "@/lib/liasse-wizard/field-meta";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import {
  getStepFieldPaths,
  liasseFormSchema,
  WIZARD_STEPS,
  type LiasseFormValues,
  type WizardStepId,
} from "@/lib/liasse-wizard/schema";
import { computeTotals } from "@/lib/liasse-wizard/totals";
import { usePayrollSidebarTotals } from "@/hooks/usePayrollSidebarTotals";
import AutoSaveIndicator from "@/components/plan/AutoSaveIndicator";
import CompletionProgressBar from "@/components/completion/CompletionProgressBar";
import { useCompletionGamification } from "@/components/completion/CompletionToasts";
import type { PlanCompletion } from "@/lib/completion";
import type { PlanPatchResult } from "@/lib/api";
import { useDebouncedPlanSave } from "@/hooks/useDebouncedPlanSave";
import { LiasseAiProvider } from "@/context/LiasseAiContext";
import WizardNavigation from "./WizardNavigation";
import WizardSidebar from "./WizardSidebar";
import WizardMobileSteps from "./WizardMobileSteps";
import PreflightCheck from "./PreflightCheck";
import LiasseUnifiedInputForm from "./LiasseUnifiedInputForm";
import StepFinancing from "./steps/StepFinancing";
import StepProducts from "./steps/StepProducts";
import StepPricing from "./steps/StepPricing";
import StepProductionCosts from "./steps/StepProductionCosts";
import StepHr from "./steps/StepHr";
import StepOtherCharges from "./steps/StepOtherCharges";
import StepTva from "./steps/StepTva";
import StepTimeline from "./steps/StepTimeline";
import { fieldPathToLiasseSection } from "@/hooks/useLiasseSectionSpy";
import { scrollToFirstErrorSection } from "@/lib/liasse-wizard/liasse-form-errors";
import { scrollToLiasseSection } from "./LiasseSectionNav";
import StepProcurement from "./steps/StepProcurement";

interface Props {
  planId: string;
  inputs: Inputs;
  onChange: (inputs: Inputs) => void;
  onSave: (result: PlanPatchResult) => void;
  readOnly?: boolean;
  missingFields?: string[];
  completion?: PlanCompletion | null;
  onPlanModuleChange?: () => void;
  onRegisterNavigator?: (fn: (step: WizardStepId, fieldPath: string) => void) => void;
}

export default function LiasseWizard({
  planId,
  inputs,
  onChange,
  onSave,
  readOnly = false,
  missingFields = [],
  completion = null,
  onPlanModuleChange,
  onRegisterNavigator,
}: Props) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const currentStep = WIZARD_STEPS[stepIndex];

  const methods = useForm<LiasseFormValues>({
    resolver: zodResolver(liasseFormSchema),
    defaultValues: inputsToFormValues(inputs),
    mode: "onBlur",
  });

  const { watch, reset, trigger, handleSubmit } = methods;
  const values = watch();

  useEffect(() => {
    reset(inputsToFormValues(inputs));
  }, [inputs, reset]);

  const { status: autoSaveStatus, persist, saving } = useDebouncedPlanSave({
    planId,
    readOnly,
    inputs,
    watchedValues: values,
    debounceMs: 1500,
    onChange,
    onSaved: onSave,
  });

  const persistWithFeedback = useCallback(
    async (showStatus = true) => {
      setSaveError("");
      const result = await persist(showStatus);
      if (result === "failed") {
        setSaveError("Erreur de sauvegarde");
      }
      return result === "saved";
    },
    [persist]
  );

  const payrollLive = usePayrollSidebarTotals(planId);

  const handlePlanModuleChange = useCallback(() => {
    onPlanModuleChange?.();
    void payrollLive.refresh();
  }, [onPlanModuleChange, payrollLive.refresh]);

  const totals = useMemo(
    () => computeTotals(values, payrollLive.payrollY1),
    [values, payrollLive.payrollY1]
  );
  const alerts = useMemo(
    () =>
      getConsistencyAlerts(values, {
        staffRoleCount: payrollLive.staffRoleCount,
      }),
    [values, payrollLive.staffRoleCount]
  );
  const preflight = useMemo(
    () => buildPreflightReport(values, missingFields),
    [values, missingFields]
  );

  const goToStep = async (target: number) => {
    if (target > stepIndex && !readOnly) {
      const paths = getStepFieldPaths(currentStep);
      const ok = await trigger(paths as never);
      if (!ok) {
        if (currentStep === "liasseInputs") {
          scrollToFirstErrorSection(methods.formState.errors);
        }
        return;
      }
      await persistWithFeedback(false);
    }
    setStepIndex(Math.max(0, Math.min(WIZARD_STEPS.length - 1, target)));
  };

  const onBack = () => goToStep(stepIndex - 1);
  const onNext = async () => {
    if (stepIndex < WIZARD_STEPS.length - 1) {
      await goToStep(stepIndex + 1);
    } else if (!readOnly) {
      const ok = await trigger();
      if (!ok && currentStep === "liasseInputs") {
        scrollToFirstErrorSection(methods.formState.errors);
      } else if (ok) {
        await persistWithFeedback(true);
      }
    }
  };

  const onSaveExit = async () => {
    if (!readOnly) {
      const ok = await trigger();
      if (ok) await persistWithFeedback(true);
    }
    router.push("/");
  };

  const stepMeta = stepMetaFor(currentStep, locale);

  useCompletionGamification(planId, completion);

  const jumpToField = useCallback((step: WizardStepId, fieldPath: string) => {
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx >= 0) setStepIndex(idx);
    setHighlightField(fieldPath);
    const liasseSection = fieldPathToLiasseSection(fieldPath);
    window.setTimeout(() => {
      if (step === "liasseInputs" && liasseSection) {
        scrollToLiasseSection(liasseSection);
      }
      const el = document.getElementById(fieldPath);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-gold-400");
      window.setTimeout(() => el?.classList.remove("ring-2", "ring-gold-400"), 2500);
    }, 400);
  }, []);

  useEffect(() => {
    if (!highlightField) return;
    const t = window.setTimeout(() => setHighlightField(null), 3000);
    return () => window.clearTimeout(t);
  }, [highlightField]);

  useEffect(() => {
    onRegisterNavigator?.(jumpToField);
  }, [jumpToField, onRegisterNavigator]);

  const renderStepBody = (id: WizardStepId) => {
    return (
      <>
        {id === "liasseInputs" ? (
          <LiasseUnifiedInputForm readOnly={readOnly} />
        ) : id === "products" ? (
          <StepProducts planId={planId} readOnly={readOnly} />
        ) : id === "pricing" ? (
          <StepPricing planId={planId} readOnly={readOnly} />
        ) : id === "productionCosts" ? (
          <StepProductionCosts
            planId={planId}
            planInputs={inputs}
            readOnly={readOnly}
          />
        ) : id === "hr" ? (
          <StepHr
            planId={planId}
            readOnly={readOnly}
            onDataChange={handlePlanModuleChange}
          />
        ) : id === "otherCharges" ? (
          <StepOtherCharges
            planId={planId}
            readOnly={readOnly}
            onDataChange={handlePlanModuleChange}
          />
        ) : id === "tva" ? (
          <StepTva
            planId={planId}
            readOnly={readOnly}
            onDataChange={handlePlanModuleChange}
          />
        ) : id === "financing" ? (
          <StepFinancing planId={planId} readOnly={readOnly} />
        ) : id === "timeline" ? (
          <StepTimeline planId={planId} readOnly={readOnly} />
        ) : id === "procurement" ? (
          <StepProcurement planId={planId} readOnly={readOnly} />
        ) : null}
        {id === "liasseInputs" && <PreflightCheck items={preflight} />}
      </>
    );
  };

  return (
    <FormProvider {...methods}>
      <LiasseAiProvider planId={planId} readOnly={readOnly}>
        <form
          onSubmit={handleSubmit(async () => {
            await persistWithFeedback(true);
          })}
          className="liasse-wizard"
        >
          <AutoSaveIndicator status={autoSaveStatus} />

          <div className="flex flex-col gap-6 md:flex-row md:gap-8">
            <WizardSidebar
              currentStep={currentStep}
              onStepClick={(id) => {
                const idx = WIZARD_STEPS.indexOf(id);
                void goToStep(idx);
              }}
              totals={totals}
              alerts={alerts}
              readOnly={readOnly}
              completion={completion}
            />

            <div className="min-w-0 flex-1">
              <WizardMobileSteps
                stepIndex={stepIndex}
                currentStep={currentStep}
                onGoTo={(i) => void goToStep(i)}
              />

              <header className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                      Étape {stepIndex + 1} / {WIZARD_STEPS.length}
                    </p>
                    <h2 className="font-display text-xl font-semibold text-navy-900 sm:text-2xl">
                      {stepMeta.title}
                    </h2>
                  </div>
                  <CompletionProgressBar completion={completion} />
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-navy-600">
                  {stepMeta.explainer}
                </p>
              </header>

              <div
                className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm sm:p-5 md:p-6"
                role="tabpanel"
              >
                {renderStepBody(currentStep)}
              </div>

              {saveError && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              )}

              <WizardNavigation
                stepIndex={stepIndex}
                totalSteps={WIZARD_STEPS.length}
                onBack={onBack}
                onNext={onNext}
                onSaveExit={onSaveExit}
                readOnly={readOnly}
                saving={saving}
              />
            </div>
          </div>
        </form>
      </LiasseAiProvider>
    </FormProvider>
  );
}
