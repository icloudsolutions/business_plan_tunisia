"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import Breadcrumb from "./Breadcrumb";

export type NavLinkItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  prefetch?: boolean;
};

export function isNavLinkActive(href: string, pathname: string): boolean {
  if (href === "/plans") {
    return (
      pathname === "/" ||
      pathname === "/plans" ||
      (pathname.startsWith("/plans/") && !pathname.startsWith("/plans/new"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const navLinkClass = (active: boolean) =>
  cn(
    "px-3 py-2 text-sm font-medium transition-colors border-b-2",
    active
      ? "text-indigo-700 border-indigo-600"
      : "text-gray-600 hover:text-indigo-600 border-transparent"
  );

type NavLinksProps = {
  className?: string;
  onNavigate?: () => void;
  /** Mobile drawer: left border accent instead of bottom border */
  variant?: "horizontal" | "mobile";
};

export function NavLinks({
  className,
  onNavigate,
  variant = "horizontal",
}: NavLinksProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslations("nav");

  const navLinks: NavLinkItem[] = [
    { href: "/plans", label: t("navPlans") },
    { href: "/finance", label: t("navFinance"), prefetch: false },
  ];

  const adminLink: NavLinkItem = {
    href: "/admin",
    label: t("navAdmin"),
    adminOnly: true,
  };

  const links = user?.role === "admin" ? [...navLinks, adminLink] : navLinks;

  return (
    <nav className={className} aria-label={t("menu")}>
      <ul
        className={
          variant === "mobile"
            ? "space-y-0.5"
            : "flex items-stretch gap-1"
        }
      >
        {links.map((link) => {
          const active = isNavLinkActive(link.href, pathname);
          const itemClass =
            variant === "mobile"
              ? cn(
                  "flex items-center gap-3 border-s-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-gray-600 hover:text-indigo-600"
                )
              : navLinkClass(active);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                prefetch={link.prefetch === false ? false : undefined}
                onClick={onNavigate}
                className={itemClass}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type NavbarProps = {
  /** Logo / brand slot (left) */
  brand?: ReactNode;
  /** Toolbar on the right (notifications, user, etc.) */
  trailing?: ReactNode;
  /** Show breadcrumb row under the main bar */
  showBreadcrumb?: boolean;
  className?: string;
};

/** Top bar: primary nav links + optional breadcrumb strip below. */
export default function Navbar({
  brand,
  trailing,
  showBreadcrumb = true,
  className,
}: NavbarProps) {
  return (
    <div className={className}>
      <div className="flex h-14 items-center gap-2 sm:h-16 sm:gap-3">
        {brand}
        <div className="hidden md:flex md:flex-1 md:items-stretch md:justify-start">
          <NavLinks />
        </div>
        {trailing}
      </div>
      {showBreadcrumb && (
        <div className="border-t border-navy-100/80 bg-white/80 px-3 py-2 sm:px-6">
          <Breadcrumb />
        </div>
      )}
    </div>
  );
}
