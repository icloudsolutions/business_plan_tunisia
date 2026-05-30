import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KPI_SUMMARY_GRID } from "./dashboard-cards";

export default function KpiSummaryGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(KPI_SUMMARY_GRID, className)}>{children}</div>;
}
