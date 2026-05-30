"use client";

import type { FieldMeta } from "@/lib/liasse-wizard/field-meta";
import FieldHelpPopover from "@/components/ui/FieldHelpPopover";

type Props = {
  meta: FieldMeta;
};

export default function FieldTooltip({ meta }: Props) {
  return (
    <FieldHelpPopover label={meta.label}>
      <div className="space-y-2">
        <p className="font-semibold text-navy-900">{meta.hint}</p>
        <p className="text-navy-500">
          <strong className="text-navy-700">Où trouver :</strong> {meta.where}
        </p>
        <p className="text-amber-800">
          <strong>Exemple :</strong> {meta.example}
        </p>
      </div>
    </FieldHelpPopover>
  );
}
