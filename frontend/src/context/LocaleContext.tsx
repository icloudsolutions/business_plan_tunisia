"use client";

/**
 * @deprecated Prefer useTranslations / useLocale from next-intl directly.
 * Kept for gradual migration of dashboard components.
 */
import { useLocale as useNextIntlLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";

export type Locale = AppLocale;

/** Keys previously under translations.fr — now under nav.* */
export type TranslationKey =
  | "appName"
  | "appTagline"
  | "navPlans"
  | "navFinance"
  | "navAdmin"
  | "logout"
  | "notifications"
  | "roleClient"
  | "roleExpert"
  | "roleAdmin"
  | "dashboardTitle"
  | "dashboardSubtitle"
  | "planOverview"
  | "sector"
  | "created"
  | "completion"
  | "workflow"
  | "continueEdit"
  | "requestReview"
  | "downloadPdf"
  | "newPlan"
  | "refresh"
  | "allPlans"
  | "noPlans"
  | "createFirst"
  | "openPlan"
  | "financeCta"
  | "stepDraft"
  | "stepReview"
  | "stepAdjust"
  | "stepValidated"
  | "exportPreparing"
  | "submitSuccess"
  | "resubmitCorrections"
  | "resubmitSuccess"
  | "breadcrumbHome";

const NAV_KEYS = new Set<string>([
  "appName",
  "appTagline",
  "navPlans",
  "navFinance",
  "navAdmin",
  "logout",
  "notifications",
  "roleClient",
  "roleExpert",
  "roleAdmin",
  "breadcrumbHome",
]);

const DASHBOARD_KEYS: Record<string, string> = {
  dashboardTitle: "title",
  dashboardSubtitle: "subtitle",
  planOverview: "planOverview",
  sector: "sector",
  created: "created",
  completion: "completion",
  workflow: "workflow",
  continueEdit: "continueEdit",
  requestReview: "requestReview",
  downloadPdf: "downloadPdf",
  newPlan: "newPlan",
  refresh: "refresh",
  allPlans: "allPlans",
  noPlans: "noPlans",
  createFirst: "createFirst",
  openPlan: "openPlan",
  financeCta: "financeCta",
  stepDraft: "stepDraft",
  stepReview: "stepReview",
  stepAdjust: "stepAdjust",
  stepValidated: "stepValidated",
  exportPreparing: "exportPreparing",
  submitSuccess: "submitSuccess",
  resubmitCorrections: "resubmitCorrections",
  resubmitSuccess: "resubmitSuccess",
};

export function useLocale() {
  const locale = useNextIntlLocale() as AppLocale;
  const tNav = useTranslations("nav");
  const tDash = useTranslations("dashboard");

  const t = (key: TranslationKey): string => {
    if (NAV_KEYS.has(key)) {
      return tNav(key as Parameters<typeof tNav>[0]);
    }
    const dashKey = DASHBOARD_KEYS[key];
    if (dashKey) {
      return tDash(dashKey as Parameters<typeof tDash>[0]);
    }
    return key;
  };

  return {
    locale,
    dir: (locale === "ar" ? "rtl" : "ltr") as "ltr" | "rtl",
    setLocale: () => {
      /* use LanguageSwitcher */
    },
    t,
  };
}

/** No-op provider — next-intl supplies locale via layout */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
