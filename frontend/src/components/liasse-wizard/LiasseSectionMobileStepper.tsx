"use client";

import {
  LIASSE_INPUT_SECTIONS,
  type LiasseInputSectionId,
} from "@/lib/liasse-wizard/liasse-input-sections";
import { scrollToLiasseSection } from "./LiasseSectionNav";

type Props = {
  activeId: LiasseInputSectionId;
  onSelect: (id: LiasseInputSectionId) => void;
};

export default function LiasseSectionMobileStepper({ activeId, onSelect }: Props) {
  return (
    <div
      className="mb-4 overflow-x-auto border-b border-navy-100 pb-3 md:hidden"
      aria-label="Sections de la liasse"
    >
      <ol className="flex min-w-max gap-2 px-1">
        {LIASSE_INPUT_SECTIONS.map((section, index) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(section.id);
                  scrollToLiasseSection(section.id);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition ${
                  active
                    ? "bg-indigo-50 ring-1 ring-indigo-300"
                    : "bg-navy-50/80 text-navy-600"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 animate-pulse"
                      : "bg-white text-navy-700 ring-1 ring-navy-200"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="max-w-[5.5rem] truncate text-[10px] font-semibold leading-tight">
                  {section.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
