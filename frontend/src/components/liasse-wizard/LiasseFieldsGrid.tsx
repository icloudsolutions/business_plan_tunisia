import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Responsive grid for numeric / text liasse fields (1 → 2 → 3 columns). */
export default function LiasseFieldsGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}
