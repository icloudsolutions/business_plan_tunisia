"use client";

import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import type { SectionCompletion } from "@/lib/completion";

type Props = {
  section: SectionCompletion | undefined;
};

export default function SectionCompletionChip({ section }: Props) {
  if (!section) return null;

  const { status, score_pct } = section;

  if (status === "complete") {
    return (
      <span
        className="ms-auto flex items-center gap-0.5 text-emerald-600"
        title={`${score_pct}% — section complète`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-[10px] tabular-nums">{score_pct}%</span>
      </span>
    );
  }

  if (status === "warning") {
    return (
      <span
        className="ms-auto flex items-center gap-0.5 text-amber-600"
        title={`${score_pct}% — champs recommandés manquants`}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-[10px] tabular-nums">{score_pct}%</span>
      </span>
    );
  }

  return (
    <span
      className="ms-auto flex items-center gap-0.5 text-red-600"
      title={`${score_pct}% — champs requis manquants`}
    >
      <Circle className="h-4 w-4 shrink-0 fill-red-100" aria-hidden />
      <span className="text-[10px] tabular-nums">{score_pct}%</span>
    </span>
  );
}
