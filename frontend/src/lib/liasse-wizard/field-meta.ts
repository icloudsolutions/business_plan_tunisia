import type { AppLocale } from "@/i18n/routing";
import frLiasse from "../../../messages/liasse-fr.json";
import arLiasse from "../../../messages/liasse-ar.json";
import enLiasse from "../../../messages/liasse-en.json";

export type FieldMeta = {
  label: string;
  hint: string;
  where: string;
  example: string;
};

type LiasseMessages = typeof frLiasse;

const BY_LOCALE: Record<AppLocale, LiasseMessages> = {
  fr: frLiasse,
  ar: arLiasse,
  en: { ...frLiasse, steps: enLiasse.steps, fallback: enLiasse.fallback },
};

export function stepMetaFor(step: string, locale: AppLocale = "fr") {
  const steps = BY_LOCALE[locale].steps as Record<string, { title: string; explainer: string }>;
  return steps[step];
}

export function metaFor(
  path: string,
  fallbackLabel: string,
  locale: AppLocale = "fr"
): FieldMeta {
  const pack = BY_LOCALE[locale];
  const fields = pack.fields as Record<string, FieldMeta>;
  const fb = pack.fallback;
  return (
    fields[path] ?? {
      label: fallbackLabel,
      hint: fb.hint,
      where: fb.where,
      example: fb.example,
    }
  );
}

/** @deprecated Use stepMetaFor(locale) — kept for imports */
export const STEP_META = frLiasse.steps;
export const FIELD_META = frLiasse.fields;
