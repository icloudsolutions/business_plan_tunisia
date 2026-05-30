"use client";

import { useLiasseAi } from "@/context/LiasseAiContext";
import ExecutiveSummaryBlock from "../ExecutiveSummaryBlock";
import WizardField from "../WizardField";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function StepFinancial({ readOnly }: Props) {
  const ai = useLiasseAi();

  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-navy-800">Besoin en fonds de roulement</h4>
      <div className="mb-6 grid gap-1 sm:grid-cols-2">
        <WizardField<LiasseFormValues>
          name="workingCapital.rawMaterialStockDays"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.packagingStockDays"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.finishedGoodsStockDays"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.clientPaymentDays"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="workingCapital.supplierPaymentDays"
          type="number"
          disabled={readOnly}
        />
      </div>
      <h4 className="mb-3 text-sm font-semibold text-navy-800">Charges & fiscalité</h4>
      <div className="grid gap-1 sm:grid-cols-2">
        <WizardField<LiasseFormValues>
          name="plAssumptions.commercialDiscount"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="plAssumptions.distributionExpensePct"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="plAssumptions.marketingExpensePct"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="plAssumptions.otherOperatingCharges"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="plAssumptions.corporateTaxRate"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
      </div>
      {ai && (
        <ExecutiveSummaryBlock
          planId={ai.planId}
          sector={ai.sector}
          companyType={ai.companyType}
          location={ai.location}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
