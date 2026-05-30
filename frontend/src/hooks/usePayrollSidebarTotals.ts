"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPayrollProjection,
  listStaffRoles,
} from "@/lib/payroll-api";

/** Live masse salariale Y1 + staff count for wizard sidebar (staff-roles module). */
export function usePayrollSidebarTotals(planId: string) {
  const [payrollY1, setPayrollY1] = useState<number | null>(null);
  const [staffRoleCount, setStaffRoleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [roles, projection] = await Promise.all([
        listStaffRoles(planId),
        getPayrollProjection(planId),
      ]);
      setStaffRoleCount(roles.length);
      const y1 = projection.by_year?.find((y) => y.year === 1);
      setPayrollY1(y1?.total_payroll ?? 0);
    } catch {
      setStaffRoleCount(0);
      setPayrollY1(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { payrollY1, staffRoleCount, loading, refresh };
}
