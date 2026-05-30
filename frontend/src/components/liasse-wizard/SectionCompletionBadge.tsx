import type { PlanCompletion } from "@/lib/completion";
import { aggregateSectionCompletion } from "@/lib/liasse-wizard/liasse-input-sections";

export default function SectionCompletionBadge({
  completion,
  completionKeys,
}: {
  completion?: PlanCompletion | null;
  completionKeys: string[];
}) {
  const { filled, total } = aggregateSectionCompletion(completion, completionKeys);
  if (total === 0) return null;

  const complete = filled >= total;
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
        complete
          ? "bg-emerald-100 text-emerald-800"
          : filled > 0
            ? "bg-amber-100 text-amber-900"
            : "bg-navy-100 text-navy-600"
      }`}
    >
      {filled}/{total} champs remplis
    </span>
  );
}
