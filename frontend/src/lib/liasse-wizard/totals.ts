import type { LiasseFormValues } from "./schema";

export type WizardTotals = {
  totalInvestissement: number;
  capitalPropre: number;
  empruntEstime: number;
  masseSalariale: number;
};

export function computeTotals(
  values: LiasseFormValues,
  payrollY1?: number | null
): WizardTotals {
  const totalInvestissement = values.investments.equipment.reduce(
    (s, e) => s + (Number(e.cost) || 0),
    0
  );
  const capitalPropre = totalInvestissement * values.financing.equityRatio;
  const empruntEstime = totalInvestissement * values.financing.debtRatio;
  const legacyPersonnel = values.plAssumptions.personnel.reduce(
    (s, p) => s + (Number(p.headcount) || 0) * (Number(p.annualSalary) || 0),
    0
  );
  const masseSalariale =
    payrollY1 != null ? payrollY1 : legacyPersonnel;
  return { totalInvestissement, capitalPropre, empruntEstime, masseSalariale };
}
