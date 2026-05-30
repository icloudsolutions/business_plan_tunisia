import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  filled: number;
  total: number;
  className?: string;
};

/** Section progress: indigo "4 / 7" or green check when complete. */
export default function CompletionBadge({ filled, total, className }: Props) {
  if (total <= 0) return null;

  const complete = filled >= total;

  if (complete) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800",
          className
        )}
        aria-label={`Section complète (${total} champs)`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">Complet</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-indigo-700",
        className
      )}
      aria-label={`${filled} sur ${total} champs remplis`}
    >
      {filled} / {total}
    </span>
  );
}
