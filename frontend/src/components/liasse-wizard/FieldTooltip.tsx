"use client";

import { HelpCircle } from "lucide-react";
import type { FieldMeta } from "@/lib/liasse-wizard/field-meta";

type Props = {
  meta: FieldMeta;
};

export default function FieldTooltip({ meta }: Props) {
  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <button
        type="button"
        className="rounded-full text-navy-400 transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        aria-label={`Aide : ${meta.label}`}
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg border border-navy-100 bg-white p-3 text-left text-xs leading-relaxed text-navy-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="mb-1 block font-semibold text-navy-900">{meta.hint}</span>
        <span className="block text-navy-500">
          <strong className="text-navy-700">Où trouver :</strong> {meta.where}
        </span>
        <span className="mt-1 block text-gold-700">
          <strong>Exemple :</strong> {meta.example}
        </span>
      </span>
    </span>
  );
}
