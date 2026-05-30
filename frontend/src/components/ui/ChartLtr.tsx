"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Recharts assumes LTR layout; wrap every chart so axes do not flip in RTL pages.
 */
export default function ChartLtr({ children, className }: Props) {
  return (
    <div className={cn("w-full", className)} style={{ direction: "ltr" }}>
      {children}
    </div>
  );
}
