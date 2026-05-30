"use client";

import { useEffect, useState } from "react";
import {
  LIASSE_INPUT_SECTIONS,
  sectionDomId,
  type LiasseInputSectionId,
} from "@/lib/liasse-wizard/liasse-input-sections";

/** Highlights the liasse section most visible in the viewport (IntersectionObserver). */
export function useLiasseSectionSpy(
  initial: LiasseInputSectionId = "identification"
): LiasseInputSectionId {
  const [activeId, setActiveId] = useState<LiasseInputSectionId>(initial);

  useEffect(() => {
    const elements = LIASSE_INPUT_SECTIONS.map((s) =>
      document.getElementById(sectionDomId(s.id))
    ).filter((el): el is HTMLElement => el != null);

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        const id = visible[0].target.id.replace(
          "liasse-section-",
          ""
        ) as LiasseInputSectionId;
        if (LIASSE_INPUT_SECTIONS.some((s) => s.id === id)) {
          setActiveId(id);
        }
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55] }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return activeId;
}

export { getSectionId as fieldPathToLiasseSection } from "@/lib/liasse-wizard/liasse-input-sections";
