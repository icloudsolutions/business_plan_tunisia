"use client";

import { Check } from "lucide-react";
import { useLocale as useIntlLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import type { PlanStatusHistoryEntry } from "@/lib/api";
import {
  timestampForStatus,
  workflowStepIndex,
  WORKFLOW_STATUSES,
  type WorkflowRole,
} from "@/lib/plan-workflow";
import { cn } from "@/lib/utils";

const STEP_LABEL_KEYS: Record<string, "DRAFT" | "UNDER_REVIEW" | "ADJUSTMENT" | "VALIDATED"> = {
  DRAFT: "DRAFT",
  UNDER_REVIEW: "UNDER_REVIEW",
  ADJUSTMENT: "ADJUSTMENT",
  VALIDATED: "VALIDATED",
};

type Props = {
  status: string;
  role?: WorkflowRole;
  history?: PlanStatusHistoryEntry[];
  /** Smaller layout for table cells */
  compact?: boolean;
  /** Hide section title (e.g. in overview card that has its own heading) */
  showHeading?: boolean;
  className?: string;
};

function StepTooltip({
  label,
  timestamp,
  locale,
  noDateLabel,
}: {
  label: string;
  timestamp: string | undefined;
  locale: AppLocale;
  noDateLabel: string;
}) {
  const text = timestamp
    ? formatDate(timestamp, locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : noDateLabel;

  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover/step:block group-focus-within/step:block"
    >
      <span className="block text-[10px] font-normal text-gray-300">{label}</span>
      <span className="tabular-nums">{text}</span>
      <span
        className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"
        aria-hidden
      />
    </span>
  );
}

export default function WorkflowStepper({
  status,
  role = "client",
  history = [],
  compact = false,
  showHeading = false,
  className = "",
}: Props) {
  const locale = useIntlLocale() as AppLocale;
  const tStatus = useTranslations("status");
  const tDash = useTranslations("dashboard");
  const current = workflowStepIndex(status);

  const circleSize = compact ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      className={cn("w-full", className)}
      aria-label={`${tDash("workflow")} — ${tStatus(status as "DRAFT")}`}
      data-workflow-role={role}
    >
      {showHeading && (
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
          {tDash("workflow")}
        </p>
      )}

      {/* Mobile: vertical */}
      <ol className="relative flex flex-col gap-0 md:hidden">
        {WORKFLOW_STATUSES.map((stepId, i) => {
          const done = i < current;
          const active = i === current;
          const future = i > current;
          const label = tStatus(STEP_LABEL_KEYS[stepId]);
          const ts = timestampForStatus(history, stepId);
          const isLast = i === WORKFLOW_STATUSES.length - 1;

          return (
            <li key={stepId} className="group/step relative flex gap-3 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    "absolute start-[calc(theme(spacing.4)+1px)] top-9 bottom-0 w-0.5",
                    done ? "bg-indigo-600" : "bg-gray-200"
                  )}
                  aria-hidden
                />
              )}
              <div className="relative shrink-0">
                <StepTooltip
                  label={label}
                  timestamp={ts}
                  locale={locale}
                  noDateLabel={tDash("statusDateUnknown")}
                />
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center rounded-full border-2 transition-colors",
                    circleSize,
                    done && "border-indigo-600 bg-indigo-600 text-white",
                    active &&
                      "border-indigo-600 bg-white text-indigo-700 ring-2 ring-indigo-400 ring-offset-2 animate-pulse",
                    future && "border-gray-300 bg-white text-gray-600"
                  )}
                >
                  {done ? (
                    <Check className={iconSize} strokeWidth={3} aria-hidden />
                  ) : (
                    <span className={cn("font-semibold", compact ? "text-[10px]" : "text-xs")}>
                      {i + 1}
                    </span>
                  )}
                </span>
              </div>
              <div className="min-w-0 pt-1">
                <p
                  className={cn(
                    "text-xs",
                    active ? "font-semibold text-gray-900" : "text-gray-500"
                  )}
                >
                  {label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop: horizontal */}
      <div className="relative hidden md:block">
        <div
          className={cn(
            "absolute start-0 end-0 bg-gray-200",
            compact ? "top-3.5 h-px" : "top-5 h-0.5"
          )}
          aria-hidden
        />
        <div
          className={cn(
            "absolute start-0 bg-indigo-600 transition-all duration-500 ease-out",
            compact ? "top-3.5 h-px" : "top-5 h-0.5"
          )}
          style={{
            width:
              current <= 0
                ? "0%"
                : `${(current / (WORKFLOW_STATUSES.length - 1)) * 100}%`,
          }}
          aria-hidden
        />
        <ol className="relative flex justify-between gap-2">
          {WORKFLOW_STATUSES.map((stepId, i) => {
            const done = i < current;
            const active = i === current;
            const future = i > current;
            const label = tStatus(STEP_LABEL_KEYS[stepId]);
            const ts = timestampForStatus(history, stepId);

            return (
              <li
                key={stepId}
                className="group/step flex min-w-0 flex-1 flex-col items-center text-center"
              >
                <div className="relative">
                  <StepTooltip
                    label={label}
                    timestamp={ts}
                    locale={locale}
                    noDateLabel={tDash("statusDateUnknown")}
                  />
                  <span
                    className={cn(
                      "relative z-10 flex items-center justify-center rounded-full border-2 transition-colors",
                      circleSize,
                      done && "border-indigo-600 bg-indigo-600 text-white",
                      active &&
                        "border-indigo-600 bg-white text-indigo-700 ring-2 ring-indigo-400 ring-offset-2 animate-pulse",
                      future && "border-gray-300 bg-white text-gray-600"
                    )}
                  >
                    {done ? (
                      <Check className={iconSize} strokeWidth={3} aria-hidden />
                    ) : (
                      <span
                        className={cn("font-semibold", compact ? "text-[10px]" : "text-xs")}
                      >
                        {i + 1}
                      </span>
                    )}
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-2 max-w-[5.5rem] truncate text-xs leading-tight",
                    active ? "font-medium text-gray-800" : "text-gray-500"
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
