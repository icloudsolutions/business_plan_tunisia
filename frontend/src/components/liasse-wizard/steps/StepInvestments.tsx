"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { createSafeId } from "@/lib/safe-id";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";
import FieldTooltip from "../FieldTooltip";
import FormField from "@/components/ui/FormField";
import { metaFor } from "@/lib/liasse-wizard/field-meta";

type Props = { readOnly?: boolean };

export default function StepInvestments({ readOnly }: Props) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<LiasseFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "investments.equipment",
  });
  const equipMeta = metaFor("investments.equipment", "Équipements");
  const arrErr = errors.investments?.equipment;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center text-sm text-navy-600">
          CAPEX détaillé
          <FieldTooltip meta={equipMeta} />
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() =>
              append({
                _clientId: createSafeId("eq"),
                name: "Nouvel équipement",
                cost: 0,
                usefulLifeYears: 5,
                acquisitionYear: 1,
                assetType: "tangible",
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-gold-100"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter
          </button>
        )}
      </div>
      {typeof arrErr === "object" && "message" in (arrErr as object) && (
        <p className="mb-2 text-xs text-red-500" role="alert">
          {(arrErr as { message?: string }).message}
        </p>
      )}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex justify-between">
              <span className="text-xs font-semibold uppercase text-navy-500">
                Équipement {index + 1}
              </span>
              {!readOnly && fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-navy-400 hover:text-red-600"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Nom"
                name={`investments.equipment.${index}.name`}
                type="text"
                register={register}
                readOnly={readOnly}
                compact
              />
              <div className={readOnly ? "mb-0" : "mb-4"}>
                <label
                  htmlFor={`investments-equipment-${index}-assetType`}
                  className="text-sm font-medium text-gray-800"
                >
                  Type
                </label>
                <select
                  id={`investments-equipment-${index}-assetType`}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:border-blue-200 disabled:bg-blue-50 disabled:text-blue-800"
                  disabled={readOnly}
                  {...register(`investments.equipment.${index}.assetType` as const)}
                >
                  <option value="tangible">Corporel</option>
                  <option value="intangible">Incorporel</option>
                </select>
              </div>
              <FormField
                label="Coût"
                name={`investments.equipment.${index}.cost`}
                unit="TND"
                register={register}
                error={errors.investments?.equipment?.[index]?.cost}
                readOnly={readOnly}
                compact
              />
              <FormField
                label="Amortissement"
                name={`investments.equipment.${index}.usefulLifeYears`}
                unit="ans"
                register={register}
                error={errors.investments?.equipment?.[index]?.usefulLifeYears}
                readOnly={readOnly}
                min={1}
                compact
              />
              <FormField
                label="Acquisition"
                name={`investments.equipment.${index}.acquisitionYear`}
                unit="an"
                register={register}
                error={errors.investments?.equipment?.[index]?.acquisitionYear}
                readOnly={readOnly}
                min={1}
                max={7}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
