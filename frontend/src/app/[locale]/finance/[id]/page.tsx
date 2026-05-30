"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { ChartSuspenseFallback } from "@/components/ui/ChartSuspense";

const FinanceLiveDashboard = dynamic(
  () => import("@/components/finance-live/FinanceLiveDashboard"),
  { ssr: false }
);

export default function FinancePlanPage() {
  const params = useParams();
  const planId = params.id as string;

  return (
    <AuthGuard>
      <Suspense fallback={<ChartSuspenseFallback />}>
        <FinanceLiveDashboard planId={planId} />
      </Suspense>
    </AuthGuard>
  );
}
