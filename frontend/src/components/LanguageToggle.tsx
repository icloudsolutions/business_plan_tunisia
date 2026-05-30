"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type AppLocale,
} from "@/i18n/routing";
import { applyDocumentDirection } from "@/lib/document-direction";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

const TOGGLE_LOCALES = ["fr", "ar"] as const satisfies readonly AppLocale[];

type ToggleLocale = (typeof TOGGLE_LOCALES)[number];

type Props = {
  className?: string;
  syncProfile?: boolean;
};

/**
 * Navbar FR | AR control — switches locale and applies RTL + Arabic font on document.
 */
export default function LanguageToggle({ className, syncProfile = false }: Props) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("language");
  const { user, refreshUser } = useAuth();

  const switchLocale = (next: ToggleLocale) => {
    if (next === locale || pending) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    applyDocumentDirection(next);
    if (syncProfile && user) {
      void updateProfile({ preferred_locale: next })
        .then(() => refreshUser())
        .catch(() => {});
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-navy-100 bg-white p-0.5 text-xs font-semibold shadow-sm",
        className
      )}
      role="group"
      aria-label={t("switchTo")}
    >
      {TOGGLE_LOCALES.map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            disabled={pending}
            onClick={() => switchLocale(l)}
            className={cn(
              "min-w-[2.25rem] rounded-md px-2.5 py-1.5 uppercase tracking-wide transition",
              active
                ? "bg-navy-800 text-gold-300"
                : "text-navy-600 hover:bg-navy-50"
            )}
            aria-pressed={active}
            title={t(l)}
          >
            {l === "fr" ? "FR" : "AR"}
          </button>
        );
      })}
    </div>
  );
}
