"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  computePayrollLine,
  monthlyProductionCost,
  unitProductionCost,
} from "@/lib/finance/calculations";
import { INITIAL_EMPLOYEES, INITIAL_PRODUCTS } from "@/lib/finance/mock-data";
import type {
  EmployeeCategory,
  FinishedProduct,
  FinanceTab,
  PayrollLine,
} from "@/lib/finance/types";

type FinanceContextValue = {
  activeTab: FinanceTab;
  setActiveTab: (tab: FinanceTab) => void;
  products: FinishedProduct[];
  employees: EmployeeCategory[];
  payrollLines: PayrollLine[];
  addProduct: () => void;
  updateProduct: (id: string, patch: Partial<FinishedProduct>) => void;
  removeProduct: (id: string) => void;
  addEmployee: () => void;
  updateEmployee: (id: string, patch: Partial<EmployeeCategory>) => void;
  removeEmployee: (id: string) => void;
  summary: {
    totalProductionCostMonthly: number;
    totalPayrollEmployer: number;
    totalHeadcount: number;
    avgUnitCost: number;
    directPayroll: number;
    indirectPayroll: number;
  };
  salaryPieData: { name: string; value: number; fill: string }[];
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [products, setProducts] = useState<FinishedProduct[]>(INITIAL_PRODUCTS);
  const [employees, setEmployees] =
    useState<EmployeeCategory[]>(INITIAL_EMPLOYEES);

  const payrollLines = useMemo(
    () => employees.map(computePayrollLine),
    [employees]
  );

  const summary = useMemo(() => {
    const totalProductionCostMonthly = products.reduce(
      (s, p) => s + monthlyProductionCost(p),
      0
    );
    const totalPayrollEmployer = payrollLines.reduce(
      (s, l) => s + l.totalEmployerCost,
      0
    );
    const totalHeadcount = employees.reduce((s, e) => s + e.headcount, 0);
    const unitCosts = products.map(unitProductionCost);
    const avgUnitCost =
      unitCosts.length > 0
        ? unitCosts.reduce((a, b) => a + b, 0) / unitCosts.length
        : 0;
    const directPayroll = payrollLines
      .filter((l) => l.laborType === "direct")
      .reduce((s, l) => s + l.totalEmployerCost, 0);
    const indirectPayroll = payrollLines
      .filter((l) => l.laborType === "indirect")
      .reduce((s, l) => s + l.totalEmployerCost, 0);

    return {
      totalProductionCostMonthly,
      totalPayrollEmployer,
      totalHeadcount,
      avgUnitCost,
      directPayroll,
      indirectPayroll,
    };
  }, [products, payrollLines, employees]);

  const salaryPieData = useMemo(() => {
    const { directPayroll, indirectPayroll } = summary;
    return [
      {
        name: "Main-d'œuvre directe",
        value: directPayroll,
        fill: "#2563eb",
      },
      {
        name: "Main-d'œuvre indirecte",
        value: indirectPayroll,
        fill: "#7c3aed",
      },
    ].filter((d) => d.value > 0);
  }, [summary]);

  const addProduct = useCallback(() => {
    setProducts((prev) => [
      ...prev,
      {
        id: newId("pf"),
        name: "Nouveau produit",
        sku: "SKU-NEW",
        unit: "unité",
        water: 0,
        electricity: 0,
        directLabor: 0,
        additives: 0,
        rawMaterials: 0,
        other: 0,
        monthlyVolume: 1000,
      },
    ]);
  }, []);

  const updateProduct = useCallback(
    (id: string, patch: Partial<FinishedProduct>) => {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addEmployee = useCallback(() => {
    setEmployees((prev) => [
      ...prev,
      {
        id: newId("emp"),
        poste: "Nouveau poste",
        department: "production",
        laborType: "direct",
        headcount: 1,
        netSalaryDesired: 900,
      },
    ]);
  }, []);

  const updateEmployee = useCallback(
    (id: string, patch: Partial<EmployeeCategory>) => {
      setEmployees((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
    },
    []
  );

  const removeEmployee = useCallback((id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      products,
      employees,
      payrollLines,
      addProduct,
      updateProduct,
      removeProduct,
      addEmployee,
      updateEmployee,
      removeEmployee,
      summary,
      salaryPieData,
    }),
    [
      activeTab,
      products,
      employees,
      payrollLines,
      addProduct,
      updateProduct,
      removeProduct,
      addEmployee,
      updateEmployee,
      removeEmployee,
      summary,
      salaryPieData,
    ]
  );

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance requires FinanceProvider");
  return ctx;
}
