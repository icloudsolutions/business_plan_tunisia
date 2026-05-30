"use client";

import { useFinance } from "@/context/FinanceContext";
import DashboardLayout from "./DashboardLayout";
import OverviewTab from "./OverviewTab";
import ProductionModule from "./ProductionModule";
import PayrollModule from "./PayrollModule";
import SalaryDistributionTab from "./SalaryDistributionTab";

export default function FinanceDashboard() {
  const { activeTab } = useFinance();

  return (
    <DashboardLayout>
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "production" && <ProductionModule />}
      {activeTab === "payroll" && <PayrollModule />}
      {activeTab === "distribution" && <SalaryDistributionTab />}
    </DashboardLayout>
  );
}
