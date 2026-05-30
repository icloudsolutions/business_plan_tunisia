"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, type AppLocale } from "@/i18n/routing";

const LOCALES: AppLocale[] = ["fr", "ar"];

const FLAGS: Record<AppLocale, string> = {
  fr: "🇫🇷",
  ar: "🇹🇳",
};

export default function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("language");

  const switchLocale = (next: AppLocale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      className="flex rounded-lg border border-navy-100 p-0.5 text-xs font-semibold"
      role="group"
      aria-label={t("switchTo")}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => switchLocale(l)}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
            locale === l
              ? "bg-navy-800 text-gold-300"
              : "text-navy-600 hover:bg-navy-50"
          }`}
          title={t(l)}
        >
          <span aria-hidden>{FLAGS[l]}</span>
          <span className="hidden sm:inline">{t(l)}</span>
          <span className="sm:hidden">{l.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
