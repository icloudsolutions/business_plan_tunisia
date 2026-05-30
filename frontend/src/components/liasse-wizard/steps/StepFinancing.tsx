"use client";

import WizardField from "../WizardField";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function StepFinancing({ readOnly }: Props) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <WizardField<LiasseFormValues>
        name="financing.equityRatio"
        type="number"
        step="0.01"
        min={0}
        max={1}
        disabled={readOnly}
      />
      <WizardField<LiasseFormValues>
        name="financing.debtRatio"
        type="number"
        step="0.01"
        min={0}
        max={1}
        disabled={readOnly}
      />
      <WizardField<LiasseFormValues>
        name="financing.loan.rate"
        type="number"
        step="0.001"
        disabled={readOnly}
      />
      <WizardField<LiasseFormValues>
        name="financing.loan.years"
        type="number"
        min={1}
        max={15}
        disabled={readOnly}
      />
      <WizardField<LiasseFormValues>
        name="financing.loan.graceMonthsPrincipal"
        type="number"
        min={0}
        max={24}
        disabled={readOnly}
      />
    </div>
  );
}
