"use client";

import { Suspense, type ReactNode } from "react";

export function ChartSuspenseFallback() {
  return <div className="animate-pulse rounded bg-gray-100 h-64" />;
}

export default function ChartSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ChartSuspenseFallback />}>{children}</Suspense>;
}
