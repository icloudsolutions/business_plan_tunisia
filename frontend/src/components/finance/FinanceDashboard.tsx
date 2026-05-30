"use client";

import { useEffect, type ReactNode } from "react";
import { useFinance } from "@/context/FinanceContext";
import DashboardLayout from "./DashboardLayout";
import OverviewTab from "./OverviewTab";
import ProductionModule from "./ProductionModule";
import PayrollModule from "./PayrollModule";
import SalaryDistributionTab from "./SalaryDistributionTab";

function TabPanel({
  active,
  tabId,
  children,
}: {
  active: boolean;
  tabId: string;
  children: ReactNode;
}) {
  return (
    <div
      id={`finance-tab-${tabId}`}
      role="tabpanel"
      hidden={!active}
      className={active ? "" : "hidden"}
    >
      {children}
    </div>
  );
}

export default function FinanceDashboard() {
  const { activeTab, flashMessage, clearFlash } = useFinance();

  useEffect(() => {
    if (!flashMessage) return;
    const t = setTimeout(clearFlash, 4000);
    return () => clearTimeout(t);
  }, [flashMessage, clearFlash]);

  return (
    <DashboardLayout>
      {flashMessage && (
        <div
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {flashMessage}
        </div>
      )}
      <TabPanel active={activeTab === "overview"} tabId="overview">
        <OverviewTab />
      </TabPanel>
      <TabPanel active={activeTab === "production"} tabId="production">
        <ProductionModule />
      </TabPanel>
      <TabPanel active={activeTab === "payroll"} tabId="payroll">
        <PayrollModule />
      </TabPanel>
      <TabPanel active={activeTab === "distribution"} tabId="distribution">
        <SalaryDistributionTab />
      </TabPanel>
    </DashboardLayout>
  );
}
