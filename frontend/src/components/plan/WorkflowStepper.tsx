"use client";

import { Check } from "lucide-react";
import { useLocale as useIntlLocale, useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import type { PlanStatusHistoryEntry } from "@/lib/api";
import {
  changedByForStatus,
  timestampForStatus,
  workflowStepIndex,
  WORKFLOW_STATUSES,
  type WorkflowRole,
  type WorkflowStatus,
} from "@/lib/plan-workflow";
import { cn } from "@/lib/utils";

export type { WorkflowStatus };

type Props = {
  status: WorkflowStatus | string;
  history?: PlanStatusHistoryEntry[];
  role?: WorkflowRole;
  compact?: boolean;
  showHeading?: boolean;
  className?: string;
};

type StepVisual = "completed" | "current" | "future";

function StepTooltipBody({
  label,
  timestamp,
  changedBy,
  locale,
  noDateLabel,
  noActorLabel,
}: {
  label: string;
  timestamp: string | undefined;
  changedBy: string | undefined;
  locale: AppLocale;
  noDateLabel: string;
  noActorLabel: string;
}) {
  const dateText = timestamp
    ? formatDate(timestamp, locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : noDateLabel;

  return (
    <div className="space-y-0.5 text-start">
      <p className="font-semibold text-white">{label}</p>
      <p className="tabular-nums text-gray-300">{dateText}</p>
      <p className="text-gray-600">{changedBy ?? noActorLabel}</p>
    </div>
  );
}

function StepCircleButton({
  visual,
  label,
  timestamp,
  changedBy,
  locale,
  noDateLabel,
  noActorLabel,
  circleSize,
  iconSize,
}: {
  visual: StepVisual;
  label: string;
  timestamp: string | undefined;
  changedBy: string | undefined;
  locale: AppLocale;
  noDateLabel: string;
  noActorLabel: string;
  circleSize: string;
  iconSize: string;
}) {
  const ariaLabel = [label, timestamp, changedBy].filter(Boolean).join(" — ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            circleSize,
            visual === "completed" && "border-indigo-600 bg-indigo-600 text-white",
            visual === "current" &&
              "border-indigo-600 bg-white ring-2 ring-indigo-400 ring-offset-2 animate-pulse",
            visual === "future" && "border-gray-300 bg-white"
          )}
          aria-label={ariaLabel}
          aria-current={visual === "current" ? "step" : undefined}
        >
          {visual === "completed" ? (
            <Check className={iconSize} strokeWidth={3} aria-hidden />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[14rem]">
        <StepTooltipBody
          label={label}
          timestamp={timestamp}
          changedBy={changedBy}
          locale={locale}
          noDateLabel={noDateLabel}
          noActorLabel={noActorLabel}
        />
      </TooltipContent>
    </Tooltip>
  );
}

export default function WorkflowStepper({
  status,
  history = [],
  role = "client",
  compact = false,
  showHeading = false,
  className = "",
}: Props) {
  const locale = useIntlLocale() as AppLocale;
  const tStatus = useTranslations("status");
  const tDash = useTranslations("dashboard");
  const current = workflowStepIndex(status);

  const circleSize = compact ? "h-7 w-7" : "h-9 w-9 md:h-10 md:w-10";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4 md:h-5 md:w-5";
  const trackTop = compact ? "top-3.5" : "top-5";

  const steps = WORKFLOW_STATUSES.map((stepId, i) => {
    const visual: StepVisual =
      i < current ? "completed" : i === current ? "current" : "future";
    return {
      stepId,
      index: i,
      visual,
      label: tStatus(stepId),
      timestamp: timestampForStatus(history, stepId),
      changedBy: changedByForStatus(history, stepId),
    };
  });

  const tooltipProps = {
    locale,
    noDateLabel: tDash("statusDateUnknown"),
    noActorLabel: tDash("statusActorUnknown"),
    circleSize,
    iconSize,
  };

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        className={cn("w-full", className)}
        aria-label={`${tDash("workflow")} — ${tStatus(status as WorkflowStatus)}`}
        data-workflow-role={role}
      >
        {showHeading && (
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
            {tDash("workflow")}
          </p>
        )}

        {/* Mobile: vertical, connector on the left */}
        <ol role="list" className="flex flex-col md:hidden">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const segmentDone = i < current;

            return (
              <li
                key={step.stepId}
                role="listitem"
                className="grid grid-cols-[12px_1fr] gap-x-3 pb-8 last:pb-0"
              >
                <div className="relative flex justify-center">
                  {!isLast && (
                    <span
                      className={cn(
                        "absolute top-5 bottom-0 w-px",
                        segmentDone ? "bg-indigo-600" : "bg-gray-200"
                      )}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col items-start">
                  <StepCircleButton
                    visual={step.visual}
                    label={step.label}
                    timestamp={step.timestamp}
                    changedBy={step.changedBy}
                    {...tooltipProps}
                  />
                  <span
                    className={cn(
                      "mt-2 text-xs text-gray-500",
                      step.visual === "current" && "font-medium text-gray-800"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Desktop: horizontal */}
        <div className="relative hidden md:block">
          <div
            className={cn("absolute inset-x-0 h-px bg-gray-200", trackTop)}
            aria-hidden
          />
          <div
            className={cn(
              "absolute start-0 h-px bg-indigo-600 transition-all duration-500 ease-out",
              trackTop
            )}
            style={{
              width:
                current <= 0
                  ? "0%"
                  : `${(current / (WORKFLOW_STATUSES.length - 1)) * 100}%`,
            }}
            aria-hidden
          />
          <ol role="list" className="relative flex justify-between gap-2">
            {steps.map((step) => (
              <li
                key={step.stepId}
                role="listitem"
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <StepCircleButton
                  visual={step.visual}
                  label={step.label}
                  timestamp={step.timestamp}
                  changedBy={step.changedBy}
                  {...tooltipProps}
                />
                <span
                  className={cn(
                    "mt-2 max-w-[5.5rem] truncate text-center text-xs text-gray-500",
                    step.visual === "current" && "font-medium text-gray-800"
                  )}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </nav>
    </TooltipProvider>
  );
}
