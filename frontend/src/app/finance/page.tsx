"use client";

import AuthGuard from "@/components/AuthGuard";
import FinanceDashboard from "@/components/finance/FinanceDashboard";
import { FinanceProvider } from "@/context/FinanceContext";

export default function FinancePage() {
  return (
    <AuthGuard>
      <FinanceProvider>
        <FinanceDashboard />
      </FinanceProvider>
    </AuthGuard>
  );
}
