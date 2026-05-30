"use client";

import { Link, usePathname } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Bell, ChevronRight, Clock, LogOut, Menu, Settings, X } from "lucide-react";
import PlanHistoryDrawer from "@/components/history/PlanHistoryDrawer";
import { useState } from "react";
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

  return (
    <header className="sticky top-0 z-50 border-b border-navy-800/10 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-[4.25rem] sm:px-6">
        <button
          type="button"
          className="rounded-lg border border-navy-100 p-2 text-navy-700 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-800 font-display text-sm font-bold text-gold-400 shadow-md">
            BP
          </span>
          <span className="hidden sm:block">
            <span className="block font-display text-sm font-semibold leading-tight text-navy-800">
              {t("appName")}
            </span>
            <span className="text-[10px] text-navy-500">{t("appTagline")}</span>
          </span>
        </Link>

        <nav className="ms-2 hidden items-center gap-1 md:flex lg:ms-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                link.active
                  ? "bg-navy-800 text-gold-300"
                  : "text-navy-600 hover:bg-navy-50 hover:text-navy-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-1 text-sm text-navy-500 sm:flex md:justify-center">
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

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {planId && (
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`rounded-lg border p-2 transition ${
                historyOpen
                  ? "border-gold-400 bg-gold-50 text-gold-800"
                  : "border-navy-100 text-navy-700 hover:bg-navy-50"
              }`}
              aria-label="Historique du plan"
              title="Historique et versions"
            >
              <Clock className="h-5 w-5" />
            </button>
          )}
          {planTitle && planCompletion && (
            <CompletionProgressBar completion={planCompletion} compact />
          )}
          <LanguageSwitcher />

          <Link
            href="/settings"
            className={`rounded-lg border p-2 transition ${
              pathname.startsWith("/settings")
                ? "border-gold-400 bg-gold-50 text-gold-800"
                : "border-navy-100 text-navy-700 hover:bg-navy-50"
            }`}
            aria-label={tNav("navSettings")}
            title={tNav("navSettings")}
          >
            <Settings className="h-5 w-5" />
          </Link>

          <span className="hidden rounded-md border border-gold-300/60 bg-gold-50 px-2 py-1 text-[10px] font-bold tracking-wider text-navy-800 sm:inline">
            {t(roleKey)}
          </span>

          <div className="relative">
            <button
              type="button"
              className="relative rounded-lg border border-navy-100 p-2 text-navy-700 transition hover:bg-navy-50"
              onClick={() => {
                setNotifOpen(!notifOpen);
                if (unreadNotifications > 0) markNotificationsRead();
              }}
              aria-label={t("notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-navy-900">
                  {unreadNotifications}
                </span>
              )}
            </button>
            {notifOpen && (
              <div
                className="absolute end-0 top-full mt-2 w-72 rounded-xl border border-navy-100 bg-white p-3 shadow-xl"
              >
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

          <button
            type="button"
            onClick={logout}
            className="hidden rounded-lg border border-navy-100 px-3 py-2 text-sm text-navy-600 hover:bg-navy-50 sm:inline-flex sm:items-center sm:gap-1"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">{t("logout")}</span>
          </button>
        </div>
      </div>

      <PlanHistoryDrawer />

      {menuOpen && (
        <nav className="border-t border-navy-100 bg-white px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                link.active ? "bg-navy-800 text-gold-300" : "text-navy-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-lg border border-navy-100 py-2 text-sm text-navy-600"
          >
            {t("logout")}
          </button>
        </nav>
      )}
    </header>
  );
}
