"use client";

import { Check } from "lucide-react";

type Props = {
  visible: boolean;
  saving?: boolean;
};

export default function SaveToast({ visible, saving }: Props) {
  if (!visible && !saving) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-navy-100 bg-white/95 px-4 py-2 text-sm text-navy-700 shadow-md backdrop-blur">
        {saving ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
            Enregistrement…
          </>
        ) : (
          <>
            <Check className="h-4 w-4 text-emerald-600" aria-hidden />
            Enregistré
          </>
        )}
      </div>
    </div>
  );
}
