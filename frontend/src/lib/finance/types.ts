export type LaborType = "direct" | "indirect";

export type Department =
  | "production"
  | "conditionnement"
  | "support"
  | "administration"
  | "direction";

export interface FinishedProduct {
  id: string;
  name: string;
  sku: string;
  unit: string;
  water: number;
  electricity: number;
  directLabor: number;
  additives: number;
  rawMaterials: number;
  other: number;
  monthlyVolume: number;
}

export interface EmployeeCategory {
  id: string;
  poste: string;
  department: Department;
  laborType: LaborType;
  headcount: number;
  netSalaryDesired: number;
}

export interface PayrollLine {
  id: string;
  poste: string;
  department: Department;
  laborType: LaborType;
  headcount: number;
  netSalaryDesired: number;
  grossSalary: number;
  employeeCharges: number;
  employerCharges: number;
  netSalary: number;
  totalEmployerCostPerCapita: number;
  totalEmployerCost: number;
}

export type FinanceTab = "overview" | "production" | "payroll" | "distribution";
