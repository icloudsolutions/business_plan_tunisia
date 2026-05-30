"use client";

import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import FinanceLiveDashboard from "@/components/finance-live/FinanceLiveDashboard";

export default function FinancePlanPage() {
  const params = useParams();
  const planId = params.id as string;

  return (
    <AuthGuard>
      <FinanceLiveDashboard planId={planId} />
    </AuthGuard>
  );
}
