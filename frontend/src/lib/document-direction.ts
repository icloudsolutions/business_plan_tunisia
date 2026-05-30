import type { AppLocale } from "@/i18n/routing";

export type TextDirection = "ltr" | "rtl";

/** Text direction for a UI locale (Arabic → RTL). */
export function localeDirection(locale: AppLocale): TextDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Client-side sync of `dir`, `lang`, and Arabic body font.
 * Default SSR markup uses `dir="ltr"`; this updates after locale change.
 */
export function applyDocumentDirection(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  const dir = localeDirection(locale);
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
  document.body.classList.toggle("font-arabic", locale === "ar");
}
