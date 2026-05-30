"use client";

import {
  LIASSE_INPUT_SECTIONS,
  sectionDomId,
  type LiasseInputSectionId,
} from "@/lib/liasse-wizard/liasse-input-sections";
import CompletionBadge from "./CompletionBadge";

type Props = {
  activeId: LiasseInputSectionId;
  onSelect: (id: LiasseInputSectionId) => void;
  fieldCounts: Record<LiasseInputSectionId, { filled: number; total: number }>;
};

export function scrollToLiasseSection(id: LiasseInputSectionId) {
  const el = document.getElementById(sectionDomId(id));
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LiasseSectionNav({ activeId, onSelect, fieldCounts }: Props) {
  return (
    <nav
      className="sticky top-24 hidden w-52 shrink-0 md:block xl:w-56"
      aria-label="Sections de la liasse"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
        Sections TIA
      </p>
      <ol className="space-y-1">
        {LIASSE_INPUT_SECTIONS.map((section, index) => {
          const active = section.id === activeId;
          const counts = fieldCounts[section.id] ?? { filled: 0, total: 0 };

          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-start transition ${
                  active
                    ? "bg-indigo-50 font-semibold text-navy-900 ring-1 ring-indigo-200"
                    : "text-navy-700 hover:bg-navy-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      active
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2"
                        : "bg-navy-100 text-navy-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{section.title}</span>
                </span>
                <span className="mt-1.5 block ps-9">
                  <CompletionBadge filled={counts.filled} total={counts.total} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
