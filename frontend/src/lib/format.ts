import type { AppLocale } from "@/i18n/routing";

export type DateFormatOptions = {
  dateStyle?: "short" | "medium" | "long";
  timeStyle?: "short";
  hijri?: boolean;
};

const FR_TAG = "fr-TN";
const EN_TAG = "en-TN";
const AR_TAG = "ar-TN-u-nu-arab";

function intlLocale(locale: AppLocale, hijri?: boolean): string {
  if (locale === "ar") {
    return hijri ? "ar-TN-u-ca-islamic-u-nu-arab" : AR_TAG;
  }
  if (locale === "en") return EN_TAG;
  return FR_TAG;
}

/** French: 1 234,56 — Arabic: ١٬٢٣٤٫٥٦ */
export function formatNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

/** Amount in Tunisian dinar */
export function formatCurrency(value: number, locale: AppLocale): string {
  const formatted = formatNumber(value, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (locale === "ar") return `${formatted} د.ت`;
  return `${formatted} TND`;
}

export function formatPercent(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(
  date: Date | string | number,
  locale: AppLocale,
  options: DateFormatOptions = { dateStyle: "medium" }
): string {
  const d = typeof date === "object" ? date : new Date(date);
  const { hijri, dateStyle, timeStyle } = options;
  return new Intl.DateTimeFormat(intlLocale(locale, hijri), {
    dateStyle,
    timeStyle,
    calendar: hijri ? "islamic" : undefined,
  } as Intl.DateTimeFormatOptions).format(d);
}

export function formatDateTime(
  date: Date | string | number,
  locale: AppLocale,
  hijri = false
): string {
  return formatDate(date, locale, {
    dateStyle: "short",
    timeStyle: "short",
    hijri,
  });
}
