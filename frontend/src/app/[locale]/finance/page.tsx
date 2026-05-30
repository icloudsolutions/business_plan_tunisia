"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import AuthGuard from "@/components/AuthGuard";
import { ChartSuspenseFallback } from "@/components/ui/ChartSuspense";

const FinanceKpiCockpit = dynamic(
  () => import("@/components/finance-live/FinanceKpiCockpit"),
  { ssr: false }
);

export default function FinancePage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
        <Suspense fallback={<ChartSuspenseFallback />}>
          <FinanceKpiCockpit />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
