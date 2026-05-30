"use client";

import { Award } from "lucide-react";
import type { PlanCompletion } from "@/lib/completion";

type Props = {
  completion: PlanCompletion | null;
  compact?: boolean;
};

export default function CompletionProgressBar({ completion, compact }: Props) {
  const pct = completion?.overall_pct ?? 0;
  const milestones = completion?.milestones_reached ?? [];

  if (compact) {
    return (
      <div
        className="hidden min-w-[140px] flex-col gap-0.5 sm:flex"
        title={`Plan complété à ${pct}%`}
      >
        <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-navy-600">
          <span>{pct}%</span>
          {milestones.includes(100) && (
            <Award className="h-3 w-3 text-gold-500" aria-hidden />
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-navy-700">
        <span>Plan complété à {pct}%</span>
        <span className="flex items-center gap-1">
          {milestones.includes(50) && (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800">
              50%
            </span>
          )}
          {milestones.includes(100) && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] text-navy-800">
              <Award className="h-3 w-3" />
              Complet
            </span>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-navy-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
