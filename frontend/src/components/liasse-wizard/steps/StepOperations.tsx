"use client";

import { useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/FormField";
import WizardField from "../WizardField";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

const YEAR_LABELS = ["An 1", "An 2", "An 3", "An 4", "An 5", "An 6", "An 7"];

type Props = { readOnly?: boolean };

export default function StepOperations({ readOnly }: Props) {
  const { register } = useFormContext<LiasseFormValues>();

  return (
    <div>
      <div className="grid gap-1 sm:grid-cols-2">
        <WizardField<LiasseFormValues>
          name="operations.capacityPerMinute"
          type="number"
          min={0}
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.workingDaysPerYear"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.hoursPerDay"
          type="number"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.rawMaterialCost"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.packagingCost"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.salePrice"
          type="number"
          step="0.01"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.wasteRate.maxAllowed"
          type="number"
          step="0.001"
          disabled={readOnly}
        />
        <WizardField<LiasseFormValues>
          name="operations.wasteRate.value"
          type="number"
          step="0.001"
          disabled={readOnly}
        />
      </div>
      <div className="mt-6 rounded-xl border border-navy-100 bg-navy-50/40 p-4">
        <h4 className="text-sm font-semibold text-navy-800">Déchet par année du plan</h4>
        <p className="mb-3 text-xs text-navy-500">
          Taux en décimal (ex. 0,01 = 1 %). Peut varier chaque année.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {YEAR_LABELS.map((label, yi) => (
            <FormField
              key={label}
              label={label}
              name={`operations.wasteRateByYear.${yi}`}
              unit="%"
              register={register}
              readOnly={readOnly}
              step="0.001"
              min={0}
              max={1}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}
