import type { PlanCompletion } from "@/lib/completion";

/** TIA liasse sections for the unified scrollable input form. */
export type LiasseInputSectionId =
  | "identification"
  | "investissement"
  | "financement"
  | "exploitation";

export type LiasseInputSection = {
  id: LiasseInputSectionId;
  title: string;
  subtitle: string;
  /** API completion section keys aggregated for the badge. */
  completionKeys: string[];
};

export const LIASSE_INPUT_SECTIONS: LiasseInputSection[] = [
  {
    id: "identification",
    title: "Identification",
    subtitle: "Raison sociale et forme juridique (registre du commerce).",
    completionKeys: ["general"],
  },
  {
    id: "investissement",
    title: "Investissement",
    subtitle: "CAPEX détaillé — immobilisations et amortissements sur 7 ans.",
    completionKeys: ["investments"],
  },
  {
    id: "financement",
    title: "Financement",
    subtitle: "Structure fonds propres / dette et paramètres d'emprunt.",
    completionKeys: ["financing"],
  },
  {
    id: "exploitation",
    title: "Exploitation",
    subtitle: "Hypothèses de production, BFR, charges et taux de déchet par année (Y1–Y7).",
    completionKeys: ["operations", "financial"],
  },
];

export const LIASSE_INPUT_FIELD_PATHS: string[] = [
  "company.name",
  "company.legalForm",
  "investments.equipment",
  "financing.equityRatio",
  "financing.debtRatio",
  "financing.loan.rate",
  "financing.loan.years",
  "financing.loan.graceMonthsPrincipal",
  "operations.capacityPerMinute",
  "operations.workingDaysPerYear",
  "operations.hoursPerDay",
  "operations.rawMaterialCost",
  "operations.packagingCost",
  "operations.salePrice",
  "operations.wasteRate.value",
  "operations.wasteRate.maxAllowed",
  ...Array.from({ length: 7 }, (_, i) => `operations.wasteRateByYear.${i}`),
  "workingCapital.clientPaymentDays",
  "workingCapital.supplierPaymentDays",
  "workingCapital.rawMaterialStockDays",
  "workingCapital.packagingStockDays",
  "workingCapital.finishedGoodsStockDays",
  "plAssumptions.commercialDiscount",
  "plAssumptions.distributionExpensePct",
  "plAssumptions.marketingExpensePct",
  "plAssumptions.otherOperatingCharges",
  "plAssumptions.corporateTaxRate",
];

export function sectionDomId(id: LiasseInputSectionId): string {
  return `liasse-section-${id}`;
}

export function aggregateSectionCompletion(
  completion: PlanCompletion | null | undefined,
  keys: string[]
): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  if (!completion) return { filled: 0, total: 0 };
  for (const key of keys) {
    const sec = completion.sections.find((s) => s.section === key);
    if (sec) {
      filled += sec.fields_filled;
      total += sec.fields_total;
    }
  }
  return { filled, total };
}
