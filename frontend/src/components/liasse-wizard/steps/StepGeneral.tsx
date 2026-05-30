"use client";

import AiContextFields from "../AiContextFields";
import WizardField from "../WizardField";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function StepGeneral({ readOnly }: Props) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <AiContextFields readOnly={readOnly} />
      <WizardField<LiasseFormValues>
        name="company.name"
        disabled={readOnly}
      />
      <WizardField<LiasseFormValues>
        name="company.legalForm"
        type="select"
        disabled={readOnly}
        options={[
          { value: "SARL", label: "SARL" },
          { value: "SUARL", label: "SUARL" },
          { value: "SA", label: "SA" },
        ]}
      />
    </div>
  );
}
