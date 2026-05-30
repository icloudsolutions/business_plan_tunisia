"use client";

import { AlertCircle, X } from "lucide-react";
import type { CompletionFieldItem } from "@/lib/completion";
import { fieldPathToStep } from "@/lib/completion";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";

type Props = {
  open: boolean;
  onClose: () => void;
  requiredMissing: CompletionFieldItem[];
  onNavigate: (step: WizardStepId, fieldPath: string) => void;
};

export default function SubmitBlockedModal({
  open,
  onClose,
  requiredMissing,
  onNavigate,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="submit-blocked-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-red-100 bg-red-50/80 px-5 py-4">
          <div className="flex gap-3">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-600" aria-hidden />
            <div>
              <h2 id="submit-blocked-title" className="font-display text-lg font-semibold text-navy-900">
                Soumission impossible
              </h2>
              <p className="mt-1 text-sm text-navy-600">
                Complétez les champs obligatoires suivants avant d&apos;envoyer le plan à l&apos;expert.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-navy-500 hover:bg-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto px-5 py-4">
          {requiredMissing.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-gold-50"
                onClick={() => {
                  onNavigate(fieldPathToStep(item.path), item.path);
                  onClose();
                }}
              >
                <span className="font-medium text-navy-900">{item.label_fr}</span>
                <span className="mt-0.5 block text-xs text-navy-500">{item.path}</span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="border-t border-navy-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-navy-800 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Continuer la saisie
          </button>
        </footer>
      </div>
    </div>
  );
}
