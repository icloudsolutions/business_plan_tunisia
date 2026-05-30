"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LIASSE_INPUT_SECTIONS,
  sectionDomId,
  type LiasseInputSectionId,
} from "@/lib/liasse-wizard/liasse-input-sections";
import type { PlanCompletion } from "@/lib/completion";
import { useLiasseSectionSpy } from "@/hooks/useLiasseSectionSpy";
import LiasseSectionNav, { scrollToLiasseSection } from "./LiasseSectionNav";
import LiasseSectionMobileStepper from "./LiasseSectionMobileStepper";
import SectionCompletionBadge from "./SectionCompletionBadge";
import IdentificationSection from "./liasse-sections/IdentificationSection";
import StepInvestments from "./steps/StepInvestments";
import FinancingRatioFields from "./liasse-sections/FinancingRatioFields";
import ExploitationLiasseSection from "./liasse-sections/ExploitationLiasseSection";

const DEFAULT_OPEN = LIASSE_INPUT_SECTIONS.map((s) => s.id);

type Props = {
  readOnly?: boolean;
  completion?: PlanCompletion | null;
};

function sectionBody(id: LiasseInputSectionId, readOnly?: boolean) {
  switch (id) {
    case "identification":
      return <IdentificationSection readOnly={readOnly} />;
    case "investissement":
      return <StepInvestments readOnly={readOnly} />;
    case "financement":
      return <FinancingRatioFields readOnly={readOnly} />;
    case "exploitation":
      return <ExploitationLiasseSection readOnly={readOnly} />;
    default:
      return null;
  }
}

export default function LiasseUnifiedInputForm({ readOnly, completion }: Props) {
  const activeId = useLiasseSectionSpy("identification");

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <LiasseSectionNav
        activeId={activeId}
        completion={completion}
        onSelect={(id) => scrollToLiasseSection(id)}
      />

      <div className="min-w-0 flex-1">
        <LiasseSectionMobileStepper
          activeId={activeId}
          onActiveChange={() => {}}
        />

        <Accordion
          type="multiple"
          defaultValue={[...DEFAULT_OPEN]}
          className="rounded-xl border border-navy-100 bg-white"
        >
          {LIASSE_INPUT_SECTIONS.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              id={sectionDomId(section.id)}
              className="scroll-mt-28 px-4 first:rounded-t-xl last:rounded-b-xl sm:px-5"
            >
              <AccordionTrigger className="gap-3 py-4 font-bold text-base text-navy-900 hover:no-underline">
                <span className="min-w-0 flex-1 text-start">
                  <span className="block">{section.title}</span>
                  <span className="mt-0.5 block text-xs font-normal text-navy-500">
                    {section.subtitle}
                  </span>
                </span>
                <SectionCompletionBadge
                  completion={completion}
                  completionKeys={section.completionKeys}
                />
              </AccordionTrigger>
              <AccordionContent className="pb-6 pt-1">
                {sectionBody(section.id, readOnly)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
