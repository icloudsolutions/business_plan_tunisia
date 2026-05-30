"use client";

import WizardField from "../WizardField";
import LiasseFieldsGrid from "../LiasseFieldsGrid";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function FinancingRatioFields({ readOnly }: Props) {
  return (
    <div className="space-y-4">
      <LiasseFieldsGrid>
        <WizardField<LiasseFormValues>
          name="financing.equityRatio"
          type="number"
          step="0.01"
          min={0}
          max={1}
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="financing.debtRatio"
          type="number"
          step="0.01"
          min={0}
          max={1}
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="financing.loan.rate"
          type="number"
          step="0.001"
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="financing.loan.years"
          type="number"
          min={1}
          max={15}
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="financing.loan.graceMonthsPrincipal"
          type="number"
          min={0}
          max={24}
          disabled={readOnly}
          compact
        />
      </LiasseFieldsGrid>
      <p className="text-xs text-navy-500">
        Pour le détail des emprunts (CMT, leasing, tableaux d&apos;amortissement), passez à
        l&apos;étape <strong>Financement</strong> du parcours.
      </p>
    </div>
  );
}
