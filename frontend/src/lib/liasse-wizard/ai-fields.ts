/** Fields that show the ✨ Aide IA button */
export const AI_ASSIST_FIELDS = new Set([
  "operations.salePrice",
  "operations.capacityPerMinute",
  "operations.rawMaterialCost",
  "operations.packagingCost",
  "workingCapital.clientPaymentDays",
  "workingCapital.supplierPaymentDays",
  "workingCapital.rawMaterialStockDays",
  "workingCapital.packagingStockDays",
  "workingCapital.finishedGoodsStockDays",
  "financing.equityRatio",
  "financing.loan.rate",
  "plAssumptions.distributionExpensePct",
  "plAssumptions.marketingExpensePct",
  "plAssumptions.otherOperatingCharges",
]);

export function isAiAssistField(fieldKey: string) {
  return AI_ASSIST_FIELDS.has(fieldKey);
}
