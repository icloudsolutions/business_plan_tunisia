import { createSafeId } from "@/lib/safe-id";
import type { Inputs } from "@/components/liasse-form-utils";
import { ensureInvestmentsEquipment, get, getArray } from "@/components/liasse-form-utils";
import type { LiasseFormValues } from "./schema";

function num(path: string, obj: Inputs, fallback: number): number {
  const v = parseFloat(get(obj, path, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

function wasteYears(obj: Inputs): number[] {
  const raw = getArray<Record<string, unknown>>(obj, "operations.wasteRateByYear");
  const parsed = raw.map((v) =>
    typeof v === "number" ? v : parseFloat(String(v)) || 0.01
  );
  const base = num("operations.wasteRate.value", obj, 0.01);
  if (parsed.length >= 7) return parsed.slice(0, 7);
  return [...parsed, ...Array(7 - parsed.length).fill(base)];
}

export function defaultFormValues(): LiasseFormValues {
  return {
    company: { name: "", legalForm: "SARL" },
    investments: {
      equipment: [
        {
          _clientId: createSafeId("eq"),
          name: "Ligne de production",
          cost: 0,
          usefulLifeYears: 5,
          acquisitionYear: 1,
          assetType: "tangible",
        },
      ],
    },
    financing: {
      equityRatio: 0.3,
      debtRatio: 0.7,
      loan: { rate: 0.083, years: 7, graceMonthsPrincipal: 12 },
    },
    operations: {
      capacityPerMinute: 0,
      workingDaysPerYear: 250,
      hoursPerDay: 8,
      rawMaterialCost: 0,
      packagingCost: 0,
      salePrice: 0,
      wasteRate: { value: 0.01, maxAllowed: 0.01 },
      wasteRateByYear: Array(7).fill(0.01),
    },
    workingCapital: {
      clientPaymentDays: 30,
      supplierPaymentDays: 30,
      rawMaterialStockDays: 30,
      packagingStockDays: 15,
      finishedGoodsStockDays: 10,
    },
    plAssumptions: {
      commercialDiscount: 0.1,
      corporateTaxRate: 0.25,
      otherOperatingCharges: 0,
      distributionExpensePct: 0,
      marketingExpensePct: 0,
      personnel: [],
    },
  };
}

export function inputsToFormValues(raw: Inputs): LiasseFormValues {
  const obj = ensureInvestmentsEquipment(raw);
  const defaults = defaultFormValues();
  const equipment = getArray<Record<string, unknown>>(obj, "investments.equipment").map(
    (row, i) => ({
      _clientId: String(row._clientId ?? createSafeId(`eq-${i}`)),
      name: String(row.name ?? ""),
      cost: Number(row.cost) || 0,
      usefulLifeYears: Number(row.usefulLifeYears) || 5,
      acquisitionYear: Number(row.acquisitionYear) || 1,
      assetType: (row.assetType === "intangible" ? "intangible" : "tangible") as
        | "intangible"
        | "tangible",
    })
  );

  const personnel = getArray<Record<string, unknown>>(obj, "plAssumptions.personnel").map(
    (row, i) => ({
      _clientId: String(row._clientId ?? createSafeId(`hr-${i}`)),
      role: String(row.role ?? ""),
      headcount: Number(row.headcount) || 0,
      annualSalary: Number(row.annualSalary) || 0,
    })
  );

  return {
    company: {
      name: get(obj, "company.name"),
      legalForm: (["SARL", "SUARL", "SA"].includes(get(obj, "company.legalForm"))
        ? get(obj, "company.legalForm")
        : "SARL") as "SARL" | "SUARL" | "SA",
    },
    investments: {
      equipment:
        equipment.length > 0 ? equipment : defaults.investments.equipment,
    },
    financing: {
      equityRatio: num("financing.equityRatio", obj, 0.3),
      debtRatio: num("financing.debtRatio", obj, 0.7),
      loan: {
        rate: num("financing.loan.rate", obj, 0.083),
        years: num("financing.loan.years", obj, 7),
        graceMonthsPrincipal: num("financing.loan.graceMonthsPrincipal", obj, 0),
      },
    },
    operations: {
      capacityPerMinute: num("operations.capacityPerMinute", obj, 0),
      workingDaysPerYear: num("operations.workingDaysPerYear", obj, 250),
      hoursPerDay: num("operations.hoursPerDay", obj, 8),
      rawMaterialCost: num("operations.rawMaterialCost", obj, 0),
      packagingCost: num("operations.packagingCost", obj, 0),
      salePrice: num("operations.salePrice", obj, 0),
      wasteRate: {
        value: num("operations.wasteRate.value", obj, 0.01),
        maxAllowed: num("operations.wasteRate.maxAllowed", obj, 0.01),
      },
      wasteRateByYear: wasteYears(obj),
    },
    workingCapital: {
      clientPaymentDays: num("workingCapital.clientPaymentDays", obj, 30),
      supplierPaymentDays: num("workingCapital.supplierPaymentDays", obj, 30),
      rawMaterialStockDays: num("workingCapital.rawMaterialStockDays", obj, 30),
      packagingStockDays: num("workingCapital.packagingStockDays", obj, 15),
      finishedGoodsStockDays: num("workingCapital.finishedGoodsStockDays", obj, 10),
    },
    plAssumptions: {
      commercialDiscount: num("plAssumptions.commercialDiscount", obj, 0.1),
      corporateTaxRate: num("plAssumptions.corporateTaxRate", obj, 0.25),
      otherOperatingCharges: num("plAssumptions.otherOperatingCharges", obj, 0),
      distributionExpensePct: num("plAssumptions.distributionExpensePct", obj, 0),
      marketingExpensePct: num("plAssumptions.marketingExpensePct", obj, 0),
      personnel,
    },
  };
}

export function formValuesToInputs(
  values: LiasseFormValues,
  base: Inputs
): Inputs {
  const out = JSON.parse(JSON.stringify(base)) as Inputs;
  out.company = {
    ...(typeof out.company === "object" && out.company ? out.company : {}),
    name: values.company.name,
    legalForm: values.company.legalForm,
  };
  out.investments = {
    ...(typeof out.investments === "object" && out.investments && !Array.isArray(out.investments)
      ? out.investments
      : {}),
    equipment: values.investments.equipment.map(
      ({ _clientId, ...row }) => ({ ...row, _clientId })
    ),
  };
  const prevFin =
    typeof out.financing === "object" && out.financing && !Array.isArray(out.financing)
      ? (out.financing as Record<string, unknown>)
      : {};
  const prevLoan =
    typeof prevFin.loan === "object" && prevFin.loan && !Array.isArray(prevFin.loan)
      ? (prevFin.loan as Record<string, unknown>)
      : {};
  out.financing = {
    ...prevFin,
    equityRatio: values.financing.equityRatio,
    debtRatio: values.financing.debtRatio,
    loan: { ...prevLoan, ...values.financing.loan },
  };
  out.operations = {
    ...(typeof out.operations === "object" ? out.operations : {}),
    ...values.operations,
  };
  out.workingCapital = values.workingCapital;
  out.plAssumptions = {
    ...(typeof out.plAssumptions === "object" ? out.plAssumptions : {}),
    ...values.plAssumptions,
    personnel: values.plAssumptions.personnel.map(({ _clientId, ...row }) => ({
      ...row,
      _clientId,
    })),
  };
  return out;
}
