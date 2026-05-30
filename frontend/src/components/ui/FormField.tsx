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

export interface FormFieldProps {
  label: string;
  name: string;
  unit?: string;
  /** Plain-text help shown in the popover. Omit to use `tooltipContent`. */
  tooltip?: string;
  /** Rich help content (overrides `tooltip` when set). */
  tooltipContent?: ReactNode;
  /** Extra controls on the label row (e.g. AI assist, comments). */
  labelActions?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  error?: FieldError;
  readOnly?: boolean;
  /** Auto-calculated or read-only fields — blue background. */
  highlight?: boolean;
  /** @default "number" */
  type?: "text" | "number";
  step?: string | number;
  min?: number;
  max?: number;
  className?: string;
  /** Tighter vertical spacing inside grids. */
  compact?: boolean;
}

function formatTooltip(text: string): ReactNode {
  const blocks = text.split(/\n\n+/).filter(Boolean);
  if (blocks.length <= 1) {
    return <p>{text}</p>;
  }
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <p key={i}>{block}</p>
      ))}
    </div>
  );
}

export default function FormField({
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
  step,
  min,
  max,
  className,
  compact = false,
}: FormFieldProps) {
  const locked = readOnly || highlight;
  const reg = register(
    name,
    type === "number" ? ({ valueAsNumber: true } as RegisterOptions) : undefined
  );

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition",
    FOCUS_RING_INPUT,
    unit ? "pe-14" : "",
    locked
      ? "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-800 focus:border-blue-300 focus:ring-blue-100"
      : "border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-indigo-100",
    error && !locked && "border-red-400 focus:border-red-500 focus:ring-red-100",
    className
  );

  return (
    <div className={cn(compact ? "mb-0" : "mb-4")}>
      <label
        htmlFor={name}
        className="flex items-center gap-1 text-sm font-medium text-gray-800"
      >
        <span className="min-w-0 flex-1">{label}</span>
        {labelActions}
        {tooltipContent ? (
          <FieldHelpPopover label={label}>{tooltipContent}</FieldHelpPopover>
        ) : tooltip ? (
          <FieldHelpPopover label={label}>{formatTooltip(tooltip)}</FieldHelpPopover>
        ) : null}
      </label>

      <div className="relative mt-1">
        <input
          id={name}
          type={type}
          step={step}
          min={min}
          max={max}
          className={inputClass}
          readOnly={locked}
          disabled={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          {...reg}
        />
        {unit ? (
          <span
            className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-xs font-medium text-gray-600"
            aria-hidden
          >
            {unit}
          </span>
        ) : null}
      </div>

      {error?.message ? (
        <p
          id={`${name}-error`}
          className="mt-1 text-xs text-red-500"
          role="alert"
        >
          {String(error.message)}
        </p>
      ) : null}
    </div>
  );
}
