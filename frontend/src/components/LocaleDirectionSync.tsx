"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { applyDocumentDirection } from "@/lib/document-direction";
import type { AppLocale } from "@/i18n/routing";

/** Keeps `<html dir>` / `<body>` font in sync with the active locale. */
export default function LocaleDirectionSync() {
  const locale = useLocale() as AppLocale;

  useEffect(() => {
    applyDocumentDirection(locale);
  }, [locale]);

  return null;
}
