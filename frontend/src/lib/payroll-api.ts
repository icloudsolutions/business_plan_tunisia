import { api } from "./api";
import { getToken } from "./auth-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface StaffRole {
  id: string;
  plan_id: string;
  function_name: string;
  qualification: string;
  is_production_imputable: boolean;
  base_monthly_salary: number;
  annual_raise_rate_override: number | null;
  sort_order: number;
}

export interface HeadcountEntry {
  id: string;
  staff_role_id: string;
  function_name: string;
  year: number;
  headcount: number;
}

export interface PayrollAssumptions {
  plan_id: string;
  annual_raise_rate: number;
  cnss_employer_rate: number;
}

export interface PayrollYearSummary {
  year: number;
  total_headcount: number;
  annual_gross: number;
  cnss: number;
  total_payroll: number;
  imputable_cost: number;
  non_imputable_cost: number;
}

export interface PayrollProjection {
  plan_id: string | null;
  assumptions: PayrollAssumptions;
  by_year: PayrollYearSummary[];
  headcount_series: number[];
  total_payroll_series: number[];
  cnss_series: number[];
  imputable_series: number[];
  non_imputable_series: number[];
}

export type StaffRoleInput = {
  function_name: string;
  qualification?: string;
  is_production_imputable?: boolean;
  base_monthly_salary: number;
  annual_raise_rate_override?: number | null;
  headcount_y1?: number;
};

export async function listStaffRoles(planId: string): Promise<StaffRole[]> {
  return api(`/plans/${planId}/staff-roles`);
}

export async function createStaffRole(
  planId: string,
  body: StaffRoleInput
): Promise<StaffRole> {
  return api(`/plans/${planId}/staff-roles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateStaffRole(
  planId: string,
  roleId: string,
  body: Partial<StaffRoleInput>
): Promise<StaffRole> {
  return api(`/plans/${planId}/staff-roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteStaffRole(planId: string, roleId: string): Promise<void> {
  await api(`/plans/${planId}/staff-roles/${roleId}`, { method: "DELETE" });
}

export async function listHeadcount(planId: string): Promise<HeadcountEntry[]> {
  return api(`/plans/${planId}/headcount-plan`);
}

export async function upsertHeadcount(
  planId: string,
  items: { staff_role_id: string; year: number; headcount: number }[]
): Promise<HeadcountEntry[]> {
  return api(`/plans/${planId}/headcount-plan`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

export async function getPayrollAssumptions(planId: string): Promise<PayrollAssumptions> {
  return api(`/plans/${planId}/payroll-assumptions`);
}

export async function updatePayrollAssumptions(
  planId: string,
  patch: { annual_raise_rate?: number; cnss_employer_rate?: number }
): Promise<PayrollAssumptions> {
  return api(`/plans/${planId}/payroll-assumptions`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function getPayrollProjection(planId: string): Promise<PayrollProjection> {
  const res = await api<{ projection: PayrollProjection }>(
    `/plans/${planId}/payroll-projection`
  );
  return res.projection;
}

export async function syncPayrollToLiasse(planId: string): Promise<{
  message: string;
  personnel_count: number;
  imputable_y1: number;
  non_imputable_y1: number;
}> {
  return api(`/plans/${planId}/payroll/sync-liasse`, { method: "POST" });
}

export async function downloadPayrollExport(
  planId: string,
  format: "csv" | "html" = "csv"
): Promise<void> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/plans/${planId}/payroll/export?format=${format}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${planId}.${format === "html" ? "html" : "csv"}`;
  if (format === "html") {
    a.target = "_blank";
    a.download = "";
    window.open(url, "_blank");
  } else {
    a.click();
  }
  URL.revokeObjectURL(url);
}
