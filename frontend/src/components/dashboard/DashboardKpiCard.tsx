"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  KPI_CARD_HINT,
  KPI_CARD_LABEL,
  KPI_CARD_SHELL,
  KPI_CARD_VALUE,
} from "./dashboard-cards";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  className?: string;
  valueClassName?: string;
  labelAdornment?: ReactNode;
};

export default function DashboardKpiCard({
  label,
  value,
  hint,
  icon,
  className,
  valueClassName,
  labelAdornment,
}: Props) {
  return (
    <div className={cn(KPI_CARD_SHELL, className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex shrink-0 items-center justify-center text-slate-600">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className={KPI_CARD_LABEL}>{label}</p>
            {labelAdornment}
          </div>
          <p className={cn(KPI_CARD_VALUE, "mt-1", valueClassName)}>{value}</p>
          {hint ? <p className={cn(KPI_CARD_HINT, "mt-0.5")}>{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
