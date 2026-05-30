"use client";

import AuthGuard from "@/components/AuthGuard";
import PlansDashboard from "@/components/dashboard/PlansDashboard";

export default function HomePage() {
  return (
    <AuthGuard>
      <PlansDashboard />
    </AuthGuard>
  );
}
