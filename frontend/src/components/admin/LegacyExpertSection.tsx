"use client";

import { AlertTriangle } from "lucide-react";
import LegacyExpertForm from "@/components/admin/LegacyExpertForm";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { showLegacyAdmin } from "@/lib/env";

type Props = {
  onExpertCreated?: () => void;
};

/**
 * Collapsible wrapper for the deprecated legacy expert form.
 * Hidden unless `NEXT_PUBLIC_SHOW_LEGACY=true`.
 */
export default function LegacyExpertSection({ onExpertCreated }: Props) {
  if (!showLegacyAdmin) {
    return null;
  }

  return (
    <Card className="border-amber-200/80 bg-amber-50/20">
      <CardContent className="pt-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="legacy-expert" className="border-none">
            <AccordionTrigger className="text-sm font-semibold text-slate-800">
              Création expert legacy (POST /api/auth/admin/experts + X-Admin-Key)
            </AccordionTrigger>
            <AccordionContent>
              <div
                className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2.5 text-sm text-amber-950"
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Ce formulaire est obsolète. Utilisez la section{" "}
                  <strong>Gestion des utilisateurs</strong>.
                </p>
              </div>
              <LegacyExpertForm onCreated={onExpertCreated} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
