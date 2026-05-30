import {
  EMPLOYEE_CNSS_RATE,
  EMPLOYER_CNSS_RATE,
  EMPLOYER_OTHER_RATE,
  IRPP_EFFECTIVE_RATE,
} from "./constants";
import type {
  EmployeeCategory,
  FinishedProduct,
  LaborType,
  PayrollLine,
} from "./types";

/** Brut mensuel à partir du net cible (approximation linéaire démo). */
export function grossFromNetDesired(netDesired: number): number {
  const retention =
    EMPLOYEE_CNSS_RATE + IRPP_EFFECTIVE_RATE;
  if (retention >= 1) return netDesired;
  return netDesired / (1 - retention);
}

export function computePayrollLine(cat: EmployeeCategory): PayrollLine {
  const grossSalary = grossFromNetDesired(cat.netSalaryDesired);
  const employeeCharges = grossSalary * EMPLOYEE_CNSS_RATE;
  const irpp = grossSalary * IRPP_EFFECTIVE_RATE;
  const netSalary = grossSalary - employeeCharges - irpp;
  const employerCharges =
    grossSalary * (EMPLOYER_CNSS_RATE + EMPLOYER_OTHER_RATE);
  const totalEmployerCostPerCapita = grossSalary + employerCharges;
  const totalEmployerCost = totalEmployerCostPerCapita * cat.headcount;

  return {
    id: cat.id,
    poste: cat.poste,
    department: cat.department,
    laborType: cat.laborType,
    headcount: cat.headcount,
    netSalaryDesired: cat.netSalaryDesired,
    grossSalary,
    employeeCharges,
    employerCharges,
    netSalary,
    totalEmployerCostPerCapita,
    totalEmployerCost,
  };
}

export function unitProductionCost(p: FinishedProduct): number {
  return (
    p.water +
    p.electricity +
    p.directLabor +
    p.additives +
    p.rawMaterials +
    p.other
  );
}

export function monthlyProductionCost(p: FinishedProduct): number {
  return unitProductionCost(p) * p.monthlyVolume;
}

export function defaultLaborType(department: EmployeeCategory["department"]): LaborType {
  return department === "production" || department === "conditionnement"
    ? "direct"
    : "indirect";
}

export function formatTnd(value: number, decimals = 0): string {
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)} %`;
}
