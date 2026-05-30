"use client";

import {
  type FieldPath,
  type FieldValues,
  useFormContext,
} from "react-hook-form";
import { MessageSquare, Sparkles } from "lucide-react";
import { useCollaboration } from "@/context/CollaborationContext";
import { useLiasseAi } from "@/context/LiasseAiContext";
import { isAiAssistField } from "@/lib/liasse-wizard/ai-fields";
import { FormField } from "@/components/ui/FormField";
import { useLocale } from "next-intl";
import { metaFor, type FieldMeta } from "@/lib/liasse-wizard/field-meta";
import { unitForField } from "@/lib/liasse-wizard/field-units";
import type { AppLocale } from "@/i18n/routing";
import { FOCUS_RING } from "@/lib/a11y";
import { cn } from "@/lib/utils";

type Props<T extends FieldValues> = {
  name: FieldPath<T>;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  step?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  highlight?: boolean;
  unit?: string;
  className?: string;
  meta?: FieldMeta;
  showAi?: boolean;
  compact?: boolean;
};

function fieldError(errors: unknown, name: string): { message?: string } | undefined {
  const parts = name.split(".");
  let cur: unknown = errors;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") break;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur && typeof cur === "object" && "message" in cur) {
    return cur as { message?: string };
  }
  return undefined;
}

function metaTooltipContent(meta: FieldMeta) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-navy-900">{meta.hint}</p>
      <p className="text-navy-500">
        <strong className="text-navy-700">Où trouver :</strong> {meta.where}
      </p>
      <p className="text-amber-800">
        <strong>Exemple :</strong> {meta.example}
      </p>
    </div>
  );
}

export default function WizardField<T extends FieldValues>({
  name,
  type = "text",
  options,
  step,
  min,
  max,
  disabled,
  highlight,
  unit,
  className = "",
  meta,
  showAi,
  compact = false,
}: Props<T>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<T>();
  const collab = useCollaboration();
  const liasseAi = useLiasseAi();
  const fieldKey = String(name);
  const hasComment =
    collab?.enabled && collab.highlightedFields.has(fieldKey);
  const locale = useLocale() as AppLocale;
  const fieldMeta = meta ?? metaFor(String(name), String(name), locale);
  const aiEnabled =
    (showAi ?? isAiAssistField(fieldKey)) && liasseAi?.openAiAssist && !disabled;
  const err = fieldError(errors, fieldKey);
  const resolvedUnit = unit ?? unitForField(fieldKey);
  const locked = disabled || (type === "select" && highlight);

  const labelActions = (
    <>
      {aiEnabled && (
        <button
          type="button"
          className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 hover:bg-violet-200"
          onClick={() => liasseAi?.openAiAssist(fieldKey)}
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Aide IA
        </button>
      )}
      {collab?.enabled && (
        <button
          type="button"
          className={cn("rounded p-0.5 text-orange-600 hover:bg-orange-100", FOCUS_RING)}
          aria-label="Commentaires sur ce champ"
          onClick={() => collab.setActiveFieldKey(fieldKey)}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
        </button>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "rounded-lg p-2 transition",
        hasComment && "bg-orange-50 ring-2 ring-orange-300"
      )}
    >
      <FormField
        label={fieldMeta.label}
        name={fieldKey}
        unit={resolvedUnit}
        tooltipContent={metaTooltipContent(fieldMeta)}
        labelActions={labelActions}
        register={register as never}
        error={err as never}
        readOnly={locked}
        highlight={highlight && type !== "select"}
        type={type}
        options={options}
        step={step}
        min={min}
        max={max}
        compact={compact}
        className={className}
      />
    </div>
  );
}
