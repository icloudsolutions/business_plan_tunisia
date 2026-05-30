"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "@/i18n/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Inputs } from "@/components/liasse-form-utils";
import {
  formValuesToInputs,
  inputsToFormValues,
} from "@/lib/liasse-wizard/defaults";
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
import SaveToast from "./SaveToast";
import CompletionProgressBar from "@/components/completion/CompletionProgressBar";
import { useCompletionGamification } from "@/components/completion/CompletionToasts";
import type { PlanCompletion } from "@/lib/completion";
import { LiasseAiProvider } from "@/context/LiasseAiContext";
import WizardNavigation from "./WizardNavigation";
import WizardSidebar from "./WizardSidebar";
import PreflightCheck from "./PreflightCheck";
import StepGeneral from "./steps/StepGeneral";
import StepInvestments from "./steps/StepInvestments";
import StepFinancing from "./steps/StepFinancing";
import StepOperations from "./steps/StepOperations";
import StepHr from "./steps/StepHr";
import StepFinancial from "./steps/StepFinancial";

const STEP_COMPONENTS: Record<
  WizardStepId,
  ComponentType<{ readOnly?: boolean }>
> = {
  general: StepGeneral,
  investments: StepInvestments,
  financing: StepFinancing,
  operations: StepOperations,
  hr: StepHr,
  financial: StepFinancial,
};

const AUTO_SAVE_MS = 30_000;

interface Props {
  planId: string;
  inputs: Inputs;
  onChange: (inputs: Inputs) => void;
  onSave: (inputs: Inputs) => Promise<void>;
  readOnly?: boolean;
  missingFields?: string[];
  completion?: PlanCompletion | null;
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
  onRegisterNavigator,
}: Props) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [saveError, setSaveError] = useState("");
  const baseRef = useRef(inputs);

  const currentStep = WIZARD_STEPS[stepIndex];

  const methods = useForm<LiasseFormValues>({
    resolver: zodResolver(liasseFormSchema),
    defaultValues: inputsToFormValues(inputs),
    mode: "onBlur",
  });

  const { watch, reset, trigger, getValues, handleSubmit } = methods;
  const values = watch();

  useEffect(() => {
    baseRef.current = inputs;
    reset(inputsToFormValues(inputs));
  }, [inputs, reset]);

  const persist = useCallback(
    async (showToast = true) => {
      if (readOnly) return;
      const vals = getValues();
      const payload = formValuesToInputs(vals, baseRef.current);
      setSaving(true);
      setSaveError("");
      try {
        await onSave(payload);
        onChange(payload);
        baseRef.current = payload;
        if (showToast) {
          setToastVisible(true);
          window.setTimeout(() => setToastVisible(false), 2500);
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Erreur de sauvegarde");
      } finally {
        setSaving(false);
      }
    },
    [getValues, onChange, onSave, readOnly]
  );

  useEffect(() => {
    if (readOnly) return;
    const id = window.setInterval(() => {
      void persist(true);
    }, AUTO_SAVE_MS);
    return () => window.clearInterval(id);
  }, [persist, readOnly]);

  const totals = useMemo(() => computeTotals(values), [values]);
  const alerts = useMemo(() => getConsistencyAlerts(values), [values]);
  const preflight = useMemo(
    () => buildPreflightReport(values, missingFields),
    [values, missingFields]
  );

  const goToStep = async (target: number) => {
    if (target > stepIndex && !readOnly) {
      const paths = getStepFieldPaths(currentStep);
      const ok = await trigger(paths as never);
      if (!ok) return;
      await persist(false);
    }
    setStepIndex(Math.max(0, Math.min(WIZARD_STEPS.length - 1, target)));
  };

  const onBack = () => goToStep(stepIndex - 1);
  const onNext = async () => {
    if (stepIndex < WIZARD_STEPS.length - 1) {
      await goToStep(stepIndex + 1);
    } else if (!readOnly) {
      const ok = await trigger();
      if (ok) await persist(true);
    }
  };

  const onSaveExit = async () => {
    if (!readOnly) {
      const ok = await trigger();
      if (ok) await persist(true);
    }
    router.push("/");
  };

  const stepMeta = stepMetaFor(currentStep, locale);

  useCompletionGamification(planId, completion);

  const jumpToField = useCallback((step: WizardStepId, fieldPath: string) => {
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx >= 0) setStepIndex(idx);
    setHighlightField(fieldPath);
    window.setTimeout(() => {
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

  return (
    <FormProvider {...methods}>
      <LiasseAiProvider planId={planId} readOnly={readOnly}>
      <form
        onSubmit={handleSubmit(async () => {
          await persist(true);
        })}
        className="liasse-wizard"
      >
        <div className="flex flex-col gap-8 lg:flex-row">
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
            <div className="mb-4 flex gap-1 overflow-x-auto pb-1 lg:hidden">
              {WIZARD_STEPS.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void goToStep(i)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    i === stepIndex
                      ? "bg-gold-500 text-white"
                      : "bg-navy-100 text-navy-600"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <header className="mb-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold-600">
                    Étape {stepIndex + 1} / {WIZARD_STEPS.length}
                  </p>
                  <h2 className="font-display text-2xl font-semibold text-navy-900">
                    {stepMeta.title}
                  </h2>
                </div>
                <CompletionProgressBar completion={completion} />
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-navy-600">
                {stepMeta.explainer}
              </p>
            </header>

            <div className="overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${stepIndex * 100}%)` }}
              >
                {WIZARD_STEPS.map((id) => {
                  const Body = STEP_COMPONENTS[id];
                  return (
                    <div
                      key={id}
                      className="w-full shrink-0 p-5 sm:p-6"
                      aria-hidden={id !== currentStep}
                    >
                      <Body readOnly={readOnly} />
                      {id === "financial" && (
                        <PreflightCheck items={preflight} />
                      )}
                    </div>
                  );
                })}
              </div>
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

        <SaveToast visible={toastVisible} saving={saving} />
      </form>
      </LiasseAiProvider>
    </FormProvider>
  );
}
