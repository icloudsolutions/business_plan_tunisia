"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type EmptyStateCta =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: EmptyStateCta;
  className?: string;
};

export default function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto max-w-sm py-16 text-center",
        className
      )}
    >
      <div className="mx-auto mb-4 flex justify-center text-gray-300 [&_svg]:h-16 [&_svg]:w-16">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      {cta && (
        <div className="mt-6">
          {cta.href ? (
            <Link
              href={cta.href}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {cta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
