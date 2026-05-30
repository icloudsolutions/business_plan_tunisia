import { api } from "./api";

export type LoanFrequency = "quarterly" | "annual";

export interface PlanLoan {
  id: string;
  plan_id: string;
  lender_name: string;
  amount: number;
  rate: number;
  term_years: number;
  grace_months: number;
  start_date: string | null;
  frequency: LoanFrequency;
  sort_order: number;
}

export interface AmortizationPeriod {
  period: number;
  date: string;
  opening_balance: number;
  payment: number;
  principal: number;
  interest: number;
  closing_balance: number;
  in_grace: boolean;
}

export interface LoanAnnualSummary {
  year: number;
  interest: number;
  principal: number;
  debt_service: number;
  ending_balance: number;
}

export interface LoanScheduleProjection {
  loan_id: string | null;
  lender_name: string;
  periods: AmortizationPeriod[];
  annual: LoanAnnualSummary[];
}

export interface CombinedLoanProjection {
  loans: LoanScheduleProjection[];
  annual_interest: number[];
  annual_principal: number[];
  annual_debt_service: number[];
  annual_ending_balance: number[];
}

export type PlanLoanInput = {
  lender_name: string;
  amount: number;
  rate: number;
  term_years: number;
  grace_months: number;
  start_date?: string | null;
  frequency: LoanFrequency;
  sort_order?: number;
};

export async function listLoans(planId: string): Promise<PlanLoan[]> {
  return api(`/plans/${planId}/loans`);
}

export async function createLoan(planId: string, body: PlanLoanInput): Promise<PlanLoan> {
  return api(`/plans/${planId}/loans`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateLoan(
  planId: string,
  loanId: string,
  body: Partial<PlanLoanInput>
): Promise<PlanLoan> {
  return api(`/plans/${planId}/loans/${loanId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteLoan(planId: string, loanId: string): Promise<void> {
  await api(`/plans/${planId}/loans/${loanId}`, { method: "DELETE" });
}

export async function getLoanProjection(planId: string): Promise<CombinedLoanProjection> {
  const res = await api<{ projection: CombinedLoanProjection }>(
    `/plans/${planId}/loan-projection`
  );
  return res.projection;
}

export async function syncLoansToLiasse(planId: string): Promise<{
  message: string;
  loan_count: number;
  primary_amount: number;
}> {
  return api(`/plans/${planId}/loans/sync-liasse`, { method: "POST" });
}
