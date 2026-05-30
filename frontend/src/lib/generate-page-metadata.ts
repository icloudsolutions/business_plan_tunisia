import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/site-metadata";

type MetaKey =
  | "homeTitle"
  | "homeDescription"
  | "plansTitle"
  | "plansDescription"
  | "planNewTitle"
  | "planNewDescription"
  | "planDetailTitle"
  | "planDetailDescription"
  | "financeTitle"
  | "financeDescription"
  | "financePlanTitle"
  | "financePlanDescription"
  | "loginTitle"
  | "loginDescription"
  | "settingsTitle"
  | "settingsDescription"
  | "adminTitle"
  | "adminDescription";

export async function generatePageMetadata(
  locale: string,
  titleKey: MetaKey,
  descriptionKey: MetaKey
) {
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata(t(titleKey), t(descriptionKey));
}
