import type { PlanCompletion } from "@/lib/completion";
import type { LiasseFormValues } from "./schema";

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
  /** API completion section keys aggregated for the badge fallback. */
  completionKeys: string[];
  /** Dot-paths counted for the section completion badge. */
  fieldPaths: string[];
};

const WASTE_YEAR_PATHS = Array.from(
  { length: 7 },
  (_, i) => `operations.wasteRateByYear.${i}`
);

export const LIASSE_INPUT_SECTIONS: LiasseInputSection[] = [
  {
    id: "identification",
    title: "Identification du projet",
    subtitle: "Raison sociale et forme juridique (registre du commerce).",
    completionKeys: ["general"],
    fieldPaths: ["company.name", "company.legalForm"],
  },
  {
    id: "investissement",
    title: "Investissements",
    subtitle: "Actifs fixes (CAPEX) et besoin en fonds de roulement.",
    completionKeys: ["investments"],
    fieldPaths: [
      "investments.equipment",
      "workingCapital.clientPaymentDays",
      "workingCapital.supplierPaymentDays",
      "workingCapital.rawMaterialStockDays",
      "workingCapital.packagingStockDays",
      "workingCapital.finishedGoodsStockDays",
    ],
  },
  {
    id: "financement",
    title: "Plan de financement",
    subtitle: "Fonds propres, emprunts, subventions et structure de financement.",
    completionKeys: ["financing"],
    fieldPaths: [
      "financing.equityRatio",
      "financing.debtRatio",
      "financing.loan.rate",
      "financing.loan.years",
      "financing.loan.graceMonthsPrincipal",
    ],
  },
  {
    id: "exploitation",
    title: "Compte d'exploitation prévisionnelle",
    subtitle: "Hypothèses de production, déchet et charges — années 1 à 7.",
    completionKeys: ["operations", "financial"],
    fieldPaths: [
      "operations.capacityPerMinute",
      "operations.workingDaysPerYear",
      "operations.hoursPerDay",
      "operations.rawMaterialCost",
      "operations.packagingCost",
      "operations.salePrice",
      "operations.wasteRate.value",
      "operations.wasteRate.maxAllowed",
      ...WASTE_YEAR_PATHS,
      "plAssumptions.commercialDiscount",
      "plAssumptions.distributionExpensePct",
      "plAssumptions.marketingExpensePct",
      "plAssumptions.otherOperatingCharges",
      "plAssumptions.corporateTaxRate",
    ],
  },
];

/** All scalar paths validated on the liasseInputs wizard step. */
export const LIASSE_INPUT_FIELD_PATHS: string[] = LIASSE_INPUT_SECTIONS.flatMap(
  (s) => s.fieldPaths
);

export function sectionDomId(id: LiasseInputSectionId): string {
  return `liasse-section-${id}`;
}

/** Maps a react-hook-form field path to its accordion section id. */
export function getSectionId(fieldPath: string): LiasseInputSectionId | null {
  if (fieldPath.startsWith("company")) return "identification";
  if (fieldPath.startsWith("investments")) return "investissement";
  if (fieldPath.startsWith("workingCapital")) return "investissement";
  if (fieldPath.startsWith("financing")) return "financement";
  if (
    fieldPath.startsWith("operations") ||
    fieldPath.startsWith("plAssumptions")
  ) {
    return "exploitation";
  }
  return null;
}

function getByPath(values: LiasseFormValues, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, values as unknown);
}

export function isLiasseFieldFilled(
  values: LiasseFormValues,
  path: string
): boolean {
  if (path === "investments.equipment") {
    const rows = values.investments?.equipment ?? [];
    return rows.some(
      (r) => String(r.name ?? "").trim().length > 0 && Number(r.cost) > 0
    );
  }
  const v = getByPath(values, path);
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return v != null && v !== "";
}

export function countSectionFields(
  values: LiasseFormValues,
  sectionId: LiasseInputSectionId
): { filled: number; total: number } {
  const section = LIASSE_INPUT_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { filled: 0, total: 0 };
  const total = section.fieldPaths.length;
  const filled = section.fieldPaths.filter((p) =>
    isLiasseFieldFilled(values, p)
  ).length;
  return { filled, total };
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