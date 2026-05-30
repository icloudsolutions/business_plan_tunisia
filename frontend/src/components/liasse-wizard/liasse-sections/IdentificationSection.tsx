"use client";

import AiContextFields from "../AiContextFields";
import WizardField from "../WizardField";
import LiasseFieldsGrid from "../LiasseFieldsGrid";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function IdentificationSection({ readOnly }: Props) {
  return (
    <div className="space-y-4">
      <AiContextFields readOnly={readOnly} />
      <LiasseFieldsGrid>
        <WizardField<LiasseFormValues>
          name="company.name"
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="company.legalForm"
          type="select"
          disabled={readOnly}
          compact
          options={[
            { value: "SARL", label: "SARL" },
            { value: "SUARL", label: "SUARL" },
            { value: "SA", label: "SA" },
          ]}
        />
      </LiasseFieldsGrid>
    </div>
  );
}
