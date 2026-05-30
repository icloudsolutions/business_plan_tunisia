"use client";

import AuthGuard from "@/components/AuthGuard";
import PlansDashboard from "@/components/dashboard/PlansDashboard";

/** Plans list (alias for dashboard plans view). */
export default function PlansPage() {
  return (
    <AuthGuard>
      <PlansDashboard />
    </AuthGuard>
  );
}
