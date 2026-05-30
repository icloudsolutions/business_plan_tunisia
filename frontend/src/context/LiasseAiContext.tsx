"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormContext } from "react-hook-form";
import AiAssistModal from "@/components/ai/AiAssistModal";
import type { LiasseFormValues } from "@/lib/liasse-wizard/schema";

type LiasseAiContextValue = {
  planId: string;
  readOnly: boolean;
  sector: string;
  setSector: (v: string) => void;
  companyType: "PME" | "GE";
  setCompanyType: (v: "PME" | "GE") => void;
  location: string;
  setLocation: (v: string) => void;
  openAiAssist: (fieldKey: string) => void;
};

const LiasseAiContext = createContext<LiasseAiContextValue | null>(null);

export function LiasseAiProvider({
  planId,
  readOnly,
  children,
}: {
  planId: string;
  readOnly?: boolean;
  children: ReactNode;
}) {
  const [modalField, setModalField] = useState<string | null>(null);
  const [sector, setSector] = useState("Commerce / industrie");
  const [companyType, setCompanyType] = useState<"PME" | "GE">("PME");
  const [location, setLocation] = useState("Tunis, Tunisie");

  const value = useMemo(
    () => ({
      planId,
      readOnly: !!readOnly,
      sector,
      setSector,
      companyType,
      setCompanyType,
      location,
      setLocation,
      openAiAssist: setModalField,
    }),
    [planId, readOnly, sector, companyType, location]
  );

  return (
    <LiasseAiContext.Provider value={value}>
      {children}
      {modalField && (
        <AiAssistModalBridge fieldKey={modalField} onClose={() => setModalField(null)} />
      )}
    </LiasseAiContext.Provider>
  );
}

function AiAssistModalBridge({
  fieldKey,
  onClose,
}: {
  fieldKey: string;
  onClose: () => void;
}) {
  const ctx = useContext(LiasseAiContext)!;
  const { setValue } = useFormContext<LiasseFormValues>();

  const onApply = useCallback(
    (key: string, val: number | string) => {
      const num = typeof val === "number" ? val : parseFloat(String(val));
      setValue(key as keyof LiasseFormValues, (isNaN(num) ? val : num) as never, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [setValue]
  );

  return (
    <AiAssistModal
      open
      onClose={onClose}
      planId={ctx.planId}
      fieldKey={fieldKey}
      sector={ctx.sector}
      companyType={ctx.companyType}
      location={ctx.location}
      onApplyValue={onApply}
      readOnly={ctx.readOnly}
    />
  );
}

export function useLiasseAi() {
  return useContext(LiasseAiContext);
}
