"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { PreflightItem } from "@/lib/liasse-wizard/consistency";

type Props = {
  items: PreflightItem[];
};

export default function PreflightCheck({ items }: Props) {
  return (
    <div className="mt-6 rounded-xl border border-navy-200 bg-gradient-to-b from-navy-50/80 to-white p-5">
      <h3 className="font-display text-lg font-semibold text-navy-900">
        Vérification avant soumission
      </h3>
      <p className="mt-1 text-sm text-navy-600">
        Contrôlez ces points avant de soumettre le plan à l&apos;expert. Vous pourrez toujours
        modifier tant que le statut est « Brouillon ».
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.label}-${i}`}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              item.severity === "ok"
                ? "bg-emerald-50 text-emerald-900"
                : item.severity === "error"
                  ? "bg-red-50 text-red-900"
                  : "bg-amber-50 text-amber-900"
            }`}
          >
            {item.severity === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>
              <span className="font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs opacity-80">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
