"use client";

import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompletionFieldItem } from "@/lib/completion";
import { fieldPathToStep } from "@/lib/completion";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";
import { FOCUS_RING } from "@/lib/a11y";
import { cn } from "@/lib/utils";

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
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-w-md p-0"
        showClose
        closeLabel="Fermer la fenêtre"
        aria-labelledby="submit-blocked-title"
        aria-describedby="submit-blocked-desc"
      >
        <DialogHeader className="border-red-100 bg-red-50/80">
          <div className="flex gap-3 pe-8">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-600" aria-hidden />
            <div>
              <DialogTitle
                id="submit-blocked-title"
                className="font-display text-lg font-semibold text-navy-900"
              >
                Soumission impossible
              </DialogTitle>
              <DialogDescription
                id="submit-blocked-desc"
                className="mt-1 text-sm text-navy-600"
              >
                Complétez les champs obligatoires suivants avant d&apos;envoyer le plan à
                l&apos;expert.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto px-5 py-4">
          {requiredMissing.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-start text-sm transition hover:bg-gold-50",
                  FOCUS_RING
                )}
                onClick={() => {
                  onNavigate(fieldPathToStep(item.path), item.path);
                  onClose();
                }}
              >
                <span className="font-medium text-navy-900">{item.label_fr}</span>
                <span className="mt-0.5 block text-xs text-navy-600">{item.path}</span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "w-full rounded-lg bg-navy-800 py-2.5 text-sm font-semibold text-white hover:bg-navy-700",
              FOCUS_RING
            )}
          >
            Continuer la saisie
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
