"use client";

import { Fragment, useMemo } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useDashboardNav } from "@/context/DashboardNavContext";
import { isPlanId, usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

type Crumb = {
  label: string;
  href?: string;
  current?: boolean;
};

function planIdFromPath(segments: string[]): string | null {
  const i = segments.indexOf("plans");
  if (i < 0) return null;
  const id = segments[i + 1];
  if (!id || id === "new") return null;
  return isPlanId(id) ? id : null;
}

function buildCrumbs(
  pathname: string,
  labels: {
    plans: string;
    edit: string;
    finance: string;
    admin: string;
    settings: string;
  },
  planTitle: string | null
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const planId = planIdFromPath(segments);
  const plansIdx = segments.indexOf("plans");

  if (plansIdx >= 0 && planId) {
    const afterId = segments[plansIdx + 2];
    const crumbs: Crumb[] = [
      { label: labels.plans, href: "/plans" },
      {
        label: planTitle?.trim() || "…",
        href: afterId ? `/plans/${planId}` : undefined,
        current: !afterId,
      },
    ];
    if (afterId === "edit") {
      crumbs[1].href = `/plans/${planId}`;
      crumbs[1].current = false;
      crumbs.push({ label: labels.edit, current: true });
    }
    return crumbs;
  }

  if (
    pathname === "/" ||
    pathname === "/plans" ||
    (plansIdx >= 0 && !planId)
  ) {
    return [{ label: labels.plans, current: true }];
  }

  if (pathname.startsWith("/finance")) {
    return [
      { label: labels.plans, href: "/plans" },
      { label: labels.finance, current: true },
    ];
  }
  if (pathname.startsWith("/admin")) {
    return [
      { label: labels.plans, href: "/plans" },
      { label: labels.admin, current: true },
    ];
  }
  if (pathname.startsWith("/settings")) {
    return [
      { label: labels.plans, href: "/plans" },
      { label: labels.settings, current: true },
    ];
  }

  return [{ label: labels.plans, current: true }];
}

type Props = {
  className?: string;
};

export default function Breadcrumb({ className }: Props) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const { presenceOthers } = useDashboardNav();

  const segments = pathname.split("/").filter(Boolean);
  const planId = planIdFromPath(segments);
  const { title: planTitle } = usePlan(planId);

  const crumbs = useMemo(
    () =>
      buildCrumbs(pathname, {
        plans: tNav("breadcrumbPlans"),
        edit: tNav("breadcrumbEdit"),
        finance: tNav("navFinance"),
        admin: tNav("navAdmin"),
        settings: tNav("navSettings"),
      }, planTitle),
    [pathname, planTitle, tNav]
  );

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label={tNav("breadcrumbAria")}
      className={cn("flex min-w-0 flex-wrap items-center gap-1 text-sm", className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const isPlanNameCrumb =
            planId != null && index === 1 && crumbs[0]?.href === "/plans";

          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && (
                <li className="shrink-0 select-none text-gray-500" aria-hidden>
                  ›
                </li>
              )}
              <li className="min-w-0">
                {crumb.href && !crumb.current ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-gray-600 hover:text-indigo-600"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "inline-flex min-w-0 max-w-[14rem] items-center gap-2 truncate sm:max-w-[20rem]",
                      isLast ? "font-medium text-gray-900" : "text-gray-600"
                    )}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {isPlanNameCrumb && presenceOthers.length > 0 && (
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
                    <span className="truncate">{crumb.label}</span>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
