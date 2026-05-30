"use client";

import AuthGuard from "@/components/AuthGuard";
import PlansDashboard from "@/components/dashboard/PlansDashboard";

export default function HomePageClient() {
  return (
    <AuthGuard>
      <PlansDashboard />
    </AuthGuard>
  );
}
