"use client";

import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  Bell,
  ChevronRight,
  Clock,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Wallet,
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

const NAV_ICONS = {
  "/": LayoutGrid,
  "/finance": Wallet,
  "/settings": Settings,
  "/admin": Settings,
} as const;

function iconBtn(active: boolean) {
  return `flex h-9 w-9 items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/80 ${
    active
      ? "border-gold-400 bg-gold-50 text-gold-800"
      : "border-navy-100 bg-white text-navy-700 shadow-sm hover:border-navy-200 hover:bg-navy-50"
  }`;
}

export default function DashboardTopNav() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const {
    planTitle,
    planId,
    planCompletion,
    historyOpen,
    setHistoryOpen,
    unreadNotifications,
    markNotificationsRead,
    presenceOthers,
  } = useDashboardNav();
  const { t } = useLocale();
  const tNav = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const roleKey = ROLE_KEYS[user?.role as keyof typeof ROLE_KEYS] ?? "roleClient";

  const navLinks = [
    { href: "/", label: t("navPlans"), active: pathname === "/" || pathname === "" },
    { href: "/finance", label: t("navFinance"), active: pathname.startsWith("/finance") },
    {
      href: "/settings",
      label: tNav("navSettings"),
      active: pathname.startsWith("/settings"),
    },
    ...(isAdmin
      ? [{ href: "/admin", label: t("navAdmin"), active: pathname.startsWith("/admin") }]
      : []),
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-navy-800/10 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
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
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2">
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

        <nav
          className="ms-1 hidden items-center gap-0.5 rounded-xl border border-navy-100/80 bg-navy-50/50 p-0.5 md:flex"
          aria-label={tNav("menu")}
        >
          {navLinks.map((link) => {
            const Icon = NAV_ICONS[link.href as keyof typeof NAV_ICONS] ?? LayoutGrid;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                  link.active
                    ? "bg-navy-800 text-gold-300 shadow-sm"
                    : "text-navy-600 hover:bg-white hover:text-navy-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="max-w-[6.5rem] truncate xl:max-w-none">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 px-2 text-sm text-navy-500 lg:flex">
          <Link href="/" className="shrink-0 hover:text-gold-600">
            {t("breadcrumbHome")}
          </Link>
          {planTitle && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50 rtl:rotate-180" />
              <span className="flex min-w-0 items-center gap-2">
                {presenceOthers.length > 0 && (
                  <span
                    className="relative flex h-2.5 w-2.5 shrink-0"
                    title={presenceOthers.map((p) => p.email).join(", ")}
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span
                      className="relative inline-flex h-2.5 w-2.5 rounded-full ring-2 ring-white"
                      style={{
                        backgroundColor: presenceOthers[0]?.color ?? "#059669",
                      }}
                    />
                  </span>
                )}
                <span className="truncate font-medium text-navy-800">{planTitle}</span>
              </span>
            </>
          )}
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          {planId && (
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className={iconBtn(historyOpen)}
              aria-label={tNav("planHistory")}
              title={tNav("planHistoryTitle")}
            >
              <Clock className="h-4 w-4" />
            </button>
          )}

          {planTitle && planCompletion && (
            <div className="hidden sm:block">
              <CompletionProgressBar completion={planCompletion} compact />
            </div>
          )}

          <div className="flex items-center gap-1 rounded-xl border border-navy-100/80 bg-navy-50/40 p-0.5">
            <LanguageSwitcher />

            <Link
              href="/settings"
              className={iconBtn(pathname.startsWith("/settings"))}
              aria-label={tNav("navSettings")}
              title={tNav("navSettings")}
            >
              <Settings className="h-4 w-4" />
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
                <Bell className="h-4 w-4" />
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
            title={t("logout")}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden xl:inline">{t("logout")}</span>
          </button>
        </div>
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
            <LanguageSwitcher />
          </div>

          <ul className="space-y-0.5">
            {navLinks.map((link) => {
              const Icon = NAV_ICONS[link.href as keyof typeof NAV_ICONS] ?? LayoutGrid;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      link.active
                        ? "bg-navy-800 text-gold-300"
                        : "text-navy-700 hover:bg-navy-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

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
