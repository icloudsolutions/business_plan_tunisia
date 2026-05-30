"use client";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import LanguageToggle from "@/components/LanguageToggle";
import Navbar, { NavLinks } from "@/components/nav/Navbar";
import { FOCUS_RING } from "@/lib/a11y";
import {
  Bell,
  Clock,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import PlanHistoryDrawer from "@/components/history/PlanHistoryDrawer";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import CompletionProgressBar from "@/components/completion/CompletionProgressBar";
import { useDashboardNav } from "@/context/DashboardNavContext";
import { useTranslations } from "next-intl";
import { useLocale } from "@/context/LocaleContext";

const ROLE_KEYS = {
  client: "roleClient",
  expert: "roleExpert",
  admin: "roleAdmin",
} as const;

function iconBtn(active: boolean) {
  return `flex h-9 w-9 items-center justify-center rounded-lg border transition ${FOCUS_RING} ${
    active
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : "border-navy-100 bg-white text-navy-700 shadow-sm hover:border-navy-200 hover:bg-navy-50"
  }`;
}

export default function DashboardTopNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const {
    planId,
    planCompletion,
    historyOpen,
    setHistoryOpen,
    unreadNotifications,
    markNotificationsRead,
  } = useDashboardNav();
  const { t } = useLocale();
  const tNav = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const roleKey = ROLE_KEYS[user?.role as keyof typeof ROLE_KEYS] ?? "roleClient";

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const brand = (
    <>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-100 text-navy-700 md:hidden"
        onClick={() => {
          setMenuOpen(!menuOpen);
          setNotifOpen(false);
        }}
        aria-expanded={menuOpen}
        aria-label={tNav("menu")}
      >
        {menuOpen ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <Menu className="h-5 w-5" aria-hidden />
        )}
      </button>
      <Link href="/plans" className="flex shrink-0 items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800 font-display text-xs font-bold text-gold-400 shadow-md sm:h-10 sm:w-10 sm:text-sm">
          BP
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate font-display text-sm font-semibold leading-tight text-navy-800">
            {t("appName")}
          </span>
          <span className="block truncate text-[10px] text-navy-500">{t("appTagline")}</span>
        </span>
      </Link>
    </>
  );

  const trailing = (
    <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
      {planId && (
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className={iconBtn(historyOpen)}
          aria-label={tNav("planHistory")}
          title={tNav("planHistoryTitle")}
        >
          <Clock className="h-4 w-4" aria-hidden />
        </button>
      )}

      {planId && planCompletion && (
        <div className="hidden sm:block">
          <CompletionProgressBar completion={planCompletion} compact />
        </div>
      )}

      <div className="flex items-center gap-1 rounded-xl border border-navy-100/80 bg-navy-50/40 p-0.5">
        <LanguageToggle />

        <Link
          href="/settings"
          className={iconBtn(pathname.startsWith("/settings"))}
          aria-label={tNav("navSettings")}
          title={tNav("navSettings")}
        >
          <Settings className="h-4 w-4" aria-hidden />
        </Link>

        <div className="relative">
          <button
            type="button"
            className={`${iconBtn(false)} relative`}
            onClick={() => {
              setNotifOpen(!notifOpen);
              setMenuOpen(false);
              if (unreadNotifications > 0) markNotificationsRead();
            }}
            aria-expanded={notifOpen}
            aria-label={t("notifications")}
          >
            <Bell className="h-4 w-4" aria-hidden />
            {unreadNotifications > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-900">
                {unreadNotifications}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute end-0 top-full z-[55] mt-1.5 w-72 rounded-xl border border-navy-100 bg-white p-3 shadow-lg ring-1 ring-navy-900/5">
              <p className="mb-2 text-xs font-semibold text-navy-800">
                {t("notifications")}
              </p>
              <ul className="space-y-2 text-xs text-navy-600">
                <li className="rounded-lg bg-navy-50 px-2 py-2">
                  {tNav("notifExpertWaiting")}
                </li>
                <li className="rounded-lg bg-gold-50 px-2 py-2">
                  {tNav("notifCompletion85")}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <span className="hidden rounded-lg border border-gold-300/50 bg-gold-50/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-800 md:inline">
        {t(roleKey)}
      </span>

      <button
        type="button"
        onClick={logout}
        className="hidden h-9 items-center gap-1.5 rounded-lg border border-navy-100 bg-white px-2.5 text-sm text-navy-600 shadow-sm transition hover:bg-navy-50 sm:inline-flex"
        aria-label={t("logout")}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden xl:inline">{t("logout")}</span>
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-navy-800/10 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <Navbar brand={brand} trailing={trailing} showBreadcrumb />
      </div>

      <PlanHistoryDrawer />

      {menuOpen && (
        <nav
          className="border-t border-navy-100 bg-white px-3 py-3 shadow-inner md:hidden"
          aria-label={tNav("menu")}
        >
          <div className="mb-3 flex items-center justify-between rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">
              {tNav("language")}
            </span>
            <LanguageToggle />
          </div>

          <NavLinks variant="mobile" onNavigate={() => setMenuOpen(false)} />

          <div className="mt-3 border-t border-navy-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-navy-100 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-50"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
