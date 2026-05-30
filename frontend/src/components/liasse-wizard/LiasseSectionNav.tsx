"use client";

import {
  LIASSE_INPUT_SECTIONS,
  sectionDomId,
  type LiasseInputSectionId,
} from "@/lib/liasse-wizard/liasse-input-sections";
import type { PlanCompletion } from "@/lib/completion";
import SectionCompletionBadge from "./SectionCompletionBadge";

type Props = {
  activeId: LiasseInputSectionId;
  onSelect: (id: LiasseInputSectionId) => void;
  completion?: PlanCompletion | null;
};

export default function LiasseSectionNav({ activeId, onSelect, completion }: Props) {
  return (
    <nav
      className="sticky top-24 hidden w-52 shrink-0 lg:block xl:w-56"
      aria-label="Sections de la liasse"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
        Sections TIA
      </p>
      <ol className="space-y-1">
        {LIASSE_INPUT_SECTIONS.map((section, index) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-start transition ${
                  active
                    ? "bg-gold-50 font-semibold text-navy-900 ring-1 ring-gold-200"
                    : "text-navy-700 hover:bg-navy-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      active ? "bg-gold-500 text-white" : "bg-navy-100 text-navy-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{section.title}</span>
                </span>
                <span className="mt-1.5 block ps-9">
                  <SectionCompletionBadge
                    completion={completion}
                    completionKeys={section.completionKeys}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function scrollToLiasseSection(id: LiasseInputSectionId) {
  const el = document.getElementById(sectionDomId(id));
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}
