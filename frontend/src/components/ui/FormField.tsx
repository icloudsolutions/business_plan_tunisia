"use client";

import type { ReactNode } from "react";
import {
  type FieldError,
  type RegisterOptions,
  type UseFormRegister,
} from "react-hook-form";
import { FOCUS_RING_INPUT } from "@/lib/a11y";
import { cn } from "@/lib/utils";
import FieldHelpPopover from "@/components/ui/FieldHelpPopover";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

export type FormFieldOption = { value: string; label: string };

export interface FormFieldProps {
  label: string;
  name: string;
  unit?: string;
  /** Plain-text help — shows an info popover beside the label. */
  tooltip?: string;
  tooltipContent?: ReactNode;
  labelActions?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  error?: FieldError;
  readOnly?: boolean;
  highlight?: boolean;
  type?: "text" | "number" | "select";
  options?: FormFieldOption[];
  step?: string | number;
  min?: number;
  max?: number;
  className?: string;
  compact?: boolean;
}

function fieldId(name: string): string {
  return name.replace(/\./g, "-");
}

export function FormField({
  label,
  name,
  unit,
  tooltip,
  tooltipContent,
  labelActions,
  register,
  error,
  readOnly = false,
  highlight = false,
  type = "number",
  options,
  step,
  min,
  max,
  className,
  compact = false,
}: FormFieldProps) {
  const id = fieldId(name);
  const locked = readOnly;
  const reg =
    type === "select"
      ? register(name)
      : register(
          name,
          type === "number"
            ? ({ valueAsNumber: true } as RegisterOptions)
            : undefined
        );

  const controlClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition",
    FOCUS_RING_INPUT,
    unit && type !== "select" ? "pe-12" : "",
    locked && "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-800",
    highlight && !locked && "border-blue-200 bg-blue-50 text-blue-800",
    !locked &&
      !highlight &&
      "border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-100",
    error &&
      !locked &&
      "border-red-400 focus:border-red-500 focus:ring-red-100",
    className
  );

  return (
    <div className={cn(compact ? "mb-0" : "mb-4")}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {labelActions}
        {tooltipContent ? (
          <FieldHelpPopover label={label}>{tooltipContent}</FieldHelpPopover>
        ) : tooltip ? (
          <InfoTooltip text={tooltip} label={label} />
        ) : null}
      </div>

      <div className="relative">
        {type === "select" && options ? (
          <select
            id={id}
            className={controlClass}
            disabled={locked}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            {...reg}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={type === "number" ? "number" : "text"}
            step={step ?? (type === "number" ? "any" : undefined)}
            min={min}
            max={max}
            readOnly={locked}
            disabled={locked}
            className={controlClass}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            {...reg}
          />
        )}
        {unit && type !== "select" ? (
          <span
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-gray-600"
            aria-hidden
          >
            {unit}
          </span>
        ) : null}
      </div>

      {error?.message ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs text-red-500"
        >
          {String(error.message)}
        </p>
      ) : null}
    </div>
  );
}

export default FormField;
