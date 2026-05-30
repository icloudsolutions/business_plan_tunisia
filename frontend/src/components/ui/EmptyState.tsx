"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type EmptyStateCta =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

export type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: EmptyStateCta;
  className?: string;
};

/** Centered empty list placeholder — no card, no border. */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="mb-4 text-gray-200 [&_svg]:h-12 [&_svg]:w-12">{icon}</div>
      <h3 className="mb-1 text-base font-medium text-gray-700">{title}</h3>
      <p className="mb-5 text-sm text-gray-500">{description}</p>
      {cta &&
        (cta.href ? (
          <Link
            href={cta.href}
            className="text-sm text-indigo-600 underline hover:text-indigo-700"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="text-sm text-indigo-600 underline hover:text-indigo-700"
          >
            {cta.label}
          </button>
        ))}
    </div>
  );
}

export default EmptyState;
