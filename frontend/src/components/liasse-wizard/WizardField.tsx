"use client";

import {
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
  useFormContext,
} from "react-hook-form";
import { MessageSquare, Sparkles } from "lucide-react";
import { useCollaboration } from "@/context/CollaborationContext";
import { useLiasseAi } from "@/context/LiasseAiContext";
import { isAiAssistField } from "@/lib/liasse-wizard/ai-fields";
import FieldTooltip from "./FieldTooltip";
import { useLocale } from "next-intl";
import { metaFor, type FieldMeta } from "@/lib/liasse-wizard/field-meta";
import type { AppLocale } from "@/i18n/routing";
import { useTranslations } from "next-intl";

type Props<T extends FieldValues> = {
  name: FieldPath<T>;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  step?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  meta?: FieldMeta;
  showAi?: boolean;
};

export default function WizardField<T extends FieldValues>({
  name,
  type = "text",
  options,
  step,
  min,
  max,
  disabled,
  className = "",
  meta,
  showAi,
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
  const tW = useTranslations("wizard");
  const fieldMeta = meta ?? metaFor(String(name), String(name), locale);
  const aiEnabled =
    (showAi ?? isAiAssistField(fieldKey)) && liasseAi?.openAiAssist && !disabled;
  const err = errors;
  let message: string | undefined;
  const parts = String(name).split(".");
  let cur: unknown = err;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") break;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur && typeof cur === "object" && "message" in cur) {
    message = String((cur as { message?: string }).message);
  }

  const reg = register(name, { valueAsNumber: type === "number" } as RegisterOptions<T>);

  const inputClass =
    "mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 shadow-sm transition focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-200 disabled:bg-navy-50 disabled:text-navy-400 " +
    (message ? "border-red-400 focus:border-red-500 focus:ring-red-100 " : "") +
    className;

  return (
    <div
      className={`mb-4 rounded-lg p-2 transition ${
        hasComment ? "bg-orange-50 ring-2 ring-orange-300" : ""
      }`}
    >
      <label htmlFor={String(name)} className="flex items-center text-sm font-medium text-navy-800">
        {fieldMeta.label}
        <FieldTooltip meta={fieldMeta} />
        <span className="ms-auto flex items-center gap-1">
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
              className="rounded p-0.5 text-orange-600 hover:bg-orange-100"
              title="Commentaires sur ce champ"
              onClick={() => collab.setActiveFieldKey(fieldKey)}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
        </span>
      </label>
      {type === "select" && options ? (
        <select id={String(name)} className={inputClass} disabled={disabled} {...reg}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={String(name)}
          type={type}
          step={step}
          min={min}
          max={max}
          className={inputClass}
          disabled={disabled}
          {...reg}
        />
      )}
      {message && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
