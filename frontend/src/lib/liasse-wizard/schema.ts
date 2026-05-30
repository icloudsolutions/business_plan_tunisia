import { z } from "zod";

export const equipmentSchema = z.object({
  _clientId: z.string().optional(),
  name: z.string().min(1, "Indiquez le nom de l'équipement"),
  cost: z.number().min(0, "Le coût doit être positif"),
  usefulLifeYears: z.number().int().min(1, "Durée minimale : 1 an"),
  acquisitionYear: z.number().int().min(1).max(7),
  assetType: z.enum(["intangible", "tangible"]),
});

export const personnelSchema = z.object({
  _clientId: z.string().optional(),
  role: z.string().min(1, "Nom du poste requis"),
  headcount: z.number().int().min(0),
  annualSalary: z.number().min(0, "Salaire invalide"),
});

export const liasseFormSchema = z
  .object({
    company: z.object({
      name: z.string().min(2, "La raison sociale est obligatoire (min. 2 caractères)"),
      legalForm: z.enum(["SARL", "SUARL", "SA"]),
    }),
    investments: z.object({
      equipment: z.array(equipmentSchema).min(1, "Ajoutez au moins un équipement"),
    }),
    financing: z.object({
      equityRatio: z.number().min(0).max(1),
      debtRatio: z.number().min(0).max(1),
      loan: z.object({
        rate: z.number().min(0).max(1),
        years: z.number().int().min(1).max(15),
        graceMonthsPrincipal: z.number().int().min(0).max(24),
      }),
    }),
    operations: z.object({
      capacityPerMinute: z.number().min(0.01, "Capacité requise"),
      workingDaysPerYear: z.number().min(1).max(366),
      hoursPerDay: z.number().min(1).max(24),
      rawMaterialCost: z.number().min(0),
      packagingCost: z.number().min(0),
      salePrice: z.number().min(0.01, "Prix de vente requis"),
      wasteRate: z.object({
        value: z.number().min(0).max(1),
        maxAllowed: z.number().min(0).max(1),
      }),
      wasteRateByYear: z.array(z.number().min(0).max(1)).length(7),
    }),
    workingCapital: z.object({
      clientPaymentDays: z.number().int().min(0).max(365),
      supplierPaymentDays: z.number().int().min(0).max(365),
      rawMaterialStockDays: z.number().int().min(0).max(365),
      packagingStockDays: z.number().int().min(0).max(365),
      finishedGoodsStockDays: z.number().int().min(0).max(365),
    }),
    plAssumptions: z.object({
      commercialDiscount: z.number().min(0).max(1),
      corporateTaxRate: z.number().min(0).max(1),
      otherOperatingCharges: z.number().min(0),
      distributionExpensePct: z.number().min(0).max(1),
      marketingExpensePct: z.number().min(0).max(1),
      personnel: z.array(personnelSchema),
    }),
  })
  .superRefine((data, ctx) => {
    const total = data.financing.equityRatio + data.financing.debtRatio;
    if (Math.abs(total - 1) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fonds propres + dette doivent totaliser 100 % (1,0)",
        path: ["financing", "debtRatio"],
      });
    }
    const wr = data.operations.wasteRate.value;
    const max = data.operations.wasteRate.maxAllowed;
    if (wr > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le déchet ne peut pas dépasser ${(max * 100).toFixed(1)} %`,
        path: ["operations", "wasteRate", "value"],
      });
    }
  });

export type LiasseFormValues = z.infer<typeof liasseFormSchema>;

export const WIZARD_STEPS = [
  "general",
  "investments",
  "financing",
  "operations",
  "timeline",
  "procurement",
  "products",
  "pricing",
  "productionCosts",
  "hr",
  "otherCharges",
  "tva",
  "financial",
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number];

const stepFields: Record<WizardStepId, (keyof LiasseFormValues | string)[]> = {
  general: ["company"],
  investments: ["investments"],
  financing: ["financing"],
  operations: ["operations"],
  timeline: [],
  procurement: [],
  products: [],
  pricing: [],
  productionCosts: [],
  hr: ["plAssumptions.personnel"],
  otherCharges: [],
  tva: [],
  financial: ["workingCapital", "plAssumptions"],
};

export function getStepFieldPaths(step: WizardStepId): string[] {
  switch (step) {
    case "general":
      return ["company.name", "company.legalForm"];
    case "investments":
      return ["investments.equipment"];
    case "financing":
      return [
        "financing.equityRatio",
        "financing.debtRatio",
        "financing.loan.rate",
        "financing.loan.years",
        "financing.loan.graceMonthsPrincipal",
      ];
    case "operations":
      return [
        "operations.capacityPerMinute",
        "operations.workingDaysPerYear",
        "operations.hoursPerDay",
        "operations.rawMaterialCost",
        "operations.packagingCost",
        "operations.salePrice",
        "operations.wasteRate.value",
        "operations.wasteRate.maxAllowed",
        ...Array.from({ length: 7 }, (_, i) => `operations.wasteRateByYear.${i}`),
      ];
    case "timeline":
      return [];
    case "procurement":
      return [];
    case "products":
      return [];
    case "pricing":
      return [];
    case "productionCosts":
      return [];
    case "hr":
      return ["plAssumptions.personnel"];
    case "otherCharges":
      return [];
    case "tva":
      return [];
    case "financial":
      return [
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
    default:
      return [];
  }
}
