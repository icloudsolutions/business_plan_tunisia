"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  locales,
  type AppLocale,
} from "@/i18n/routing";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/lib/api";

export const LOCALE_FLAGS: Record<AppLocale, string> = {
  fr: "🇫🇷",
  ar: "🇹🇳",
  en: "🇬🇧",
};

type Props = {
  /** Persist locale to user profile when signed in */
  syncProfile?: boolean;
  /** compact: flag only + dropdown; panel: full segmented control (settings) */
  variant?: "compact" | "panel";
};

export default function LanguageSwitcher({
  syncProfile = false,
  variant = "compact",
}: Props) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("language");
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const switchLocale = (next: AppLocale) => {
    if (next === locale || pending) return;
    setOpen(false);
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    if (syncProfile && user) {
      void updateProfile({ preferred_locale: next })
        .then(() => refreshUser())
        .catch(() => {});
    }
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  if (variant === "panel") {
    return (
      <div
        className="inline-flex rounded-lg border border-navy-100 p-0.5 text-xs font-semibold"
        role="group"
        aria-label={t("switchTo")}
      >
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            disabled={pending}
            onClick={() => switchLocale(l)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
              locale === l
                ? "bg-navy-800 text-gold-300"
                : "text-navy-600 hover:bg-navy-50"
            }`}
            title={t(l)}
          >
            <span aria-hidden className="text-base leading-none">
              {LOCALE_FLAGS[l]}
            </span>
            <span>{t(l)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-100 bg-white text-lg leading-none shadow-sm transition hover:border-gold-300/60 hover:bg-gold-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/80 disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t("switchTo")} — ${t(locale)}`}
        title={t(locale)}
      >
        <span aria-hidden>{LOCALE_FLAGS[locale]}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("switchTo")}
          className="absolute end-0 top-full z-[60] mt-1.5 min-w-[10.5rem] overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-lg ring-1 ring-navy-900/5"
        >
          {locales.map((l) => {
            const active = l === locale;
            return (
              <li key={l} role="option" aria-selected={active}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => switchLocale(l)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition ${
                    active
                      ? "bg-navy-800 text-gold-300"
                      : "text-navy-700 hover:bg-navy-50"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {LOCALE_FLAGS[l]}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{t(l)}</span>
                  {active && (
                    <Check className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
