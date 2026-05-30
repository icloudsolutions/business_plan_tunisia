import type { FieldErrors } from "react-hook-form";
import {
  getSectionId,
  sectionDomId,
  type LiasseInputSectionId,
} from "./liasse-input-sections";
import type { LiasseFormValues } from "./schema";

function isFieldError(value: unknown): value is { message?: string } {
  return (
    value != null &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

/** First leaf field path in react-hook-form errors (stable key order). */
export function firstErrorFieldPath(
  errors: FieldErrors<LiasseFormValues>
): string | null {
  function walk(node: unknown, prefix: string): string | null {
    if (!node || typeof node !== "object") return null;
    if (isFieldError(node)) return prefix || null;

    for (const key of Object.keys(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      const child = (node as Record<string, unknown>)[key];
      if (isFieldError(child)) return next;
      const nested = walk(child, next);
      if (nested) return nested;
    }
    return null;
  }

  return walk(errors, "");
}

/** Scroll viewport to the accordion section containing the first validation error. */
export function scrollToFirstErrorSection(
  errors: FieldErrors<LiasseFormValues>
): LiasseInputSectionId | null {
  const path = firstErrorFieldPath(errors);
  if (!path) return null;

  const sectionId = getSectionId(path);
  if (!sectionId) return null;

  document.getElementById(sectionDomId(sectionId))?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  return sectionId;
}
