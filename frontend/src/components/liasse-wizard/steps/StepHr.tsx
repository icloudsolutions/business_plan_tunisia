"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { createSafeId } from "@/lib/safe-id";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type Props = { readOnly?: boolean };

export default function StepHr({ readOnly }: Props) {
  const { control, register } = useFormContext<LiasseFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "plAssumptions.personnel",
  });

  return (
    <div>
      <p className="mb-4 text-sm text-navy-600">
        Saisissez chaque poste (direction, production, commercial…). La masse salariale annuelle
        apparaît dans la barre latérale.
      </p>
      {!readOnly && (
        <button
          type="button"
          onClick={() =>
            append({
              _clientId: createSafeId("hr"),
              role: "",
              headcount: 1,
              annualSalary: 0,
            })
          }
          className="mb-4 inline-flex items-center gap-1 rounded-lg border border-gold-300 bg-gold-50 px-3 py-1.5 text-sm font-medium text-navy-800"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter un poste
        </button>
      )}
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy-200 px-4 py-6 text-center text-sm text-navy-500">
          Aucun poste — optionnel, mais recommandé pour un plan crédible.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-xl border border-navy-100 p-4 sm:grid-cols-4"
            >
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-navy-700">Poste</label>
                <input
                  className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                  disabled={readOnly}
                  {...register(`plAssumptions.personnel.${index}.role` as const)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy-700">Effectif</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                  disabled={readOnly}
                  {...register(`plAssumptions.personnel.${index}.headcount` as const, {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-navy-700">Salaire annuel (TND)</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm"
                    disabled={readOnly}
                    {...register(`plAssumptions.personnel.${index}.annualSalary` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="mt-6 text-navy-400 hover:text-red-600"
                    onClick={() => remove(index)}
                    aria-label="Supprimer le poste"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
