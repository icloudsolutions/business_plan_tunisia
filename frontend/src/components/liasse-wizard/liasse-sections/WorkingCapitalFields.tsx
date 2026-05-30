"use client";

import WizardField from "../WizardField";
import LiasseFieldsGrid from "../LiasseFieldsGrid";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function WorkingCapitalFields({ readOnly }: Props) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-navy-800">
        Fonds de roulement (stocks & délais)
      </h4>
      <LiasseFieldsGrid>
        <WizardField<LiasseFormValues>
          name="workingCapital.rawMaterialStockDays"
          type="number"
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.packagingStockDays"
          type="number"
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.finishedGoodsStockDays"
          type="number"
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.clientPaymentDays"
          type="number"
          disabled={readOnly}
          compact
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.supplierPaymentDays"
          type="number"
          disabled={readOnly}
          compact
        />
      </LiasseFieldsGrid>
    </div>
  );
}
