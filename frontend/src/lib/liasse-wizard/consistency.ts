import type { LiasseFormValues } from "./schema";
import { computeTotals } from "./totals";

export type ConsistencyAlert = {
  id: string;
  severity: "warning" | "error";
  message: string;
};

export type ConsistencyOptions = {
  /** Staff roles from payroll API (preferred over legacy liasse personnel). */
  staffRoleCount?: number;
};

export function getConsistencyAlerts(
  values: LiasseFormValues,
  options?: ConsistencyOptions
): ConsistencyAlert[] {
  const alerts: ConsistencyAlert[] = [];
  const { totalInvestissement, capitalPropre, empruntEstime } = computeTotals(values);
  const ratioSum = values.financing.equityRatio + values.financing.debtRatio;

  if (Math.abs(ratioSum - 1) > 0.01) {
    alerts.push({
      id: "ratio-sum",
      severity: "error",
      message: `Fonds propres + dette = ${(ratioSum * 100).toFixed(0)} % — doit être 100 %.`,
    });
  }

  if (totalInvestissement > 0 && capitalPropre + empruntEstime < totalInvestissement * 0.99) {
    alerts.push({
      id: "financing-gap",
      severity: "error",
      message:
        "Le financement (FP + emprunt) semble inférieur au total investissement. Vérifiez les pourcentages.",
    });
  }

  if (totalInvestissement === 0) {
    alerts.push({
      id: "no-capex",
      severity: "warning",
      message: "Aucun investissement saisi — le CAPEX total est à 0 TND.",
    });
  }

  if (values.operations.salePrice > 0 && values.operations.salePrice <= values.operations.rawMaterialCost) {
    alerts.push({
      id: "margin-negative",
      severity: "warning",
      message: "Le prix de vente est inférieur ou égal au coût matière : marge brute négative.",
    });
  }

  if (values.operations.wasteRate.value > values.operations.wasteRate.maxAllowed) {
    alerts.push({
      id: "waste-over-max",
      severity: "error",
      message: "Le taux de déchet dépasse le plafond autorisé.",
    });
  }

  const staffCount =
    options?.staffRoleCount ?? values.plAssumptions.personnel.length;
  if (staffCount === 0) {
    alerts.push({
      id: "no-personnel",
      severity: "warning",
      message: "Aucun poste RH saisi — la masse salariale sera nulle.",
    });
  }

  if (!values.company.name.trim()) {
    alerts.push({
      id: "no-name",
      severity: "warning",
      message: "Raison sociale manquante.",
    });
  }

  return alerts;
}
