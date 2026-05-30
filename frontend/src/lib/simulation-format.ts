/** Format simulation deltas (VAN in TND, TRI as decimal IRR). */

import type { AppLocale } from "@/i18n/routing";

const INTL_LOCALE: Record<AppLocale, string> = {
  fr: "fr-TN",
  en: "en-TN",
  ar: "ar-TN",
};

function intlTag(locale?: string): string {
  if (locale === "en" || locale === "ar" || locale === "fr") {
    return INTL_LOCALE[locale];
  }
  return "fr-TN";
}

export function isValidIrr(tri: number | null | undefined): boolean {
  return typeof tri === "number" && Number.isFinite(tri) && tri > -0.99 && tri < 5;
}

/** Δ TRI in percentage points (e.g. 0.02 → "+2,00 pp"). */
export function formatDeltaTriPp(
  delta: number | null | undefined,
  locale?: string
): string {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) > 1) return "—";
  const pp = delta * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toLocaleString(intlTag(locale), { maximumFractionDigits: 2 })} pp`;
}

export function formatIrrRate(tri: number | null | undefined, locale?: string): string {
  if (!isValidIrr(tri)) return "—";
  return `${(tri! * 100).toLocaleString(intlTag(locale), { maximumFractionDigits: 2 })} %`;
}

export function formatVanDelta(
  value: number | null | undefined,
  locale?: string
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(intlTag(locale), { maximumFractionDigits: 0 })}`;
}

export function formatRunwayYear(year: number | null | undefined): string {
  if (year == null || year <= 0) return "—";
  return `Y${year}`;
}
