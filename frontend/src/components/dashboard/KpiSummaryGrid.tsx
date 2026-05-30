import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KPI_SUMMARY_GRID, KPI_SUMMARY_GRID_UP_TO_3 } from "./dashboard-cards";

export default function KpiSummaryGrid({
  children,
  className,
  /** Use when row may exceed 4 cards (e.g. financing years). */
  dense,
}: {
  children: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn(dense ? KPI_SUMMARY_GRID_UP_TO_3 : KPI_SUMMARY_GRID, className)}>
      {children}
    </div>
  );
}
