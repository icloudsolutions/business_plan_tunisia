"use client";

import { useTranslations } from "next-intl";
import type { AutoSaveStatus } from "@/hooks/useDebouncedPlanSave";

type Props = {
  status: AutoSaveStatus;
};

export default function AutoSaveIndicator({ status }: Props) {
  const t = useTranslations("plan");

  if (status === "idle") return null;

  const label =
    status === "saving"
      ? t("autoSaving")
      : status === "saved"
        ? t("autoSaved")
        : t("autoSaveError");

  const tone =
    status === "error"
      ? "border-red-200/80 bg-red-50/95 text-red-800"
      : "border-navy-100/80 bg-white/95 text-navy-700";

  return (
    <div
      className={`pointer-events-none fixed end-4 top-4 z-[60] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-opacity duration-500 ${tone} ${
        status === "saved" ? "opacity-70" : "opacity-100"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      {status === "saving" && (
        <span
          className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-2 border-gold-500 border-t-transparent"
          aria-hidden
        />
      )}
      {label}
    </div>
  );
}
