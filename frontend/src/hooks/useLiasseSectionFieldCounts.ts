"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  countSectionFields,
  LIASSE_INPUT_SECTIONS,
  type LiasseInputSectionId,
} from "@/lib/liasse-wizard/liasse-input-sections";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

export function useLiasseSectionFieldCounts(): Record<
  LiasseInputSectionId,
  { filled: number; total: number }
> {
  const { control } = useFormContext<LiasseFormValues>();
  const values = useWatch({ control });

  return useMemo(() => {
    const formValues = (values ?? {}) as LiasseFormValues;
    return Object.fromEntries(
      LIASSE_INPUT_SECTIONS.map((s) => [
        s.id,
        countSectionFields(formValues, s.id),
      ])
    ) as Record<LiasseInputSectionId, { filled: number; total: number }>;
  }, [values]);
}
