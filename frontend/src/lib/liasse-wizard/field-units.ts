/** Unit suffixes for Liasse numeric fields (shown inside the input). */
const FIELD_UNITS: Record<string, string> = {
  "financing.equityRatio": "%",
  "financing.debtRatio": "%",
  "financing.loan.rate": "%",
  "financing.loan.years": "ans",
  "financing.loan.graceMonthsPrincipal": "mois",
  "operations.capacityPerMinute": "u/min",
  "operations.workingDaysPerYear": "j",
  "operations.hoursPerDay": "h",
  "operations.rawMaterialCost": "TND",
  "operations.packagingCost": "TND",
  "operations.salePrice": "TND",
  "operations.wasteRate.value": "%",
  "operations.wasteRate.maxAllowed": "%",
  "workingCapital.rawMaterialStockDays": "jours",
  "workingCapital.packagingStockDays": "jours",
  "workingCapital.finishedGoodsStockDays": "jours",
  "workingCapital.clientPaymentDays": "jours",
  "workingCapital.supplierPaymentDays": "jours",
  "plAssumptions.commercialDiscount": "%",
  "plAssumptions.distributionExpensePct": "%",
  "plAssumptions.marketingExpensePct": "%",
  "plAssumptions.otherOperatingCharges": "TND",
  "plAssumptions.corporateTaxRate": "%",
  "financial.corporateTaxRate": "%",
};

export function unitForField(path: string): string | undefined {
  if (FIELD_UNITS[path]) return FIELD_UNITS[path];
  if (path.startsWith("operations.wasteRateByYear.")) return "%";
  if (path.endsWith(".cost")) return "TND";
  if (path.endsWith(".usefulLifeYears")) return "ans";
  return undefined;
}
