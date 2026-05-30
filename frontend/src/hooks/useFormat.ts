"use client";

import { useLocale } from "next-intl";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  type DateFormatOptions,
} from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";

export function useFormat() {
  const locale = useLocale() as AppLocale;

  return {
    locale,
    formatNumber: (v: number, opts?: Intl.NumberFormatOptions) =>
      formatNumber(v, locale, opts),
    formatCurrency: (v: number) => formatCurrency(v, locale),
    formatPercent: (v: number) => formatPercent(v, locale),
    formatDate: (d: Date | string | number, opts?: DateFormatOptions) =>
      formatDate(d, locale, opts),
    formatDateTime: (d: Date | string | number, hijri = false) =>
      formatDateTime(d, locale, hijri),
    /** Arabic locale: optional Hijri calendar display */
    formatDateHijri: (d: Date | string | number) =>
      formatDate(d, locale, { dateStyle: "long", hijri: locale === "ar" }),
  };
}
