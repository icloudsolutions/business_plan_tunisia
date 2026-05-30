import { defineRouting } from "next-intl/routing";

export const locales = ["fr", "ar"] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: "fr",
  localePrefix: "always",
});

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_STORAGE_KEY = "bp_locale";
