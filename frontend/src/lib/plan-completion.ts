import type { Plan } from "@/lib/api";

/** Champs requis alignés sur bp_schema.validation (approximation côté client). */
const REQUIRED_COUNT = 10;

function get(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function totalCapex(inputs: Record<string, unknown>): number {
  const inv = inputs.investments as Record<string, unknown> | undefined;
  if (!inv) return 0;
  let t = 0;
  const eq = inv.equipment as { cost?: number }[] | undefined;
  if (Array.isArray(eq)) t += eq.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const intang = inv.intangible as { amount?: number }[] | undefined;
  if (Array.isArray(intang)) t += intang.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const tang = inv.tangible as { amount?: number }[] | undefined;
  if (Array.isArray(tang)) t += tang.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return t;
}

export function computePlanCompletion(plan: Plan): {
  percent: number;
  filled: number;
  total: number;
} {
  const inputs = plan.inputs || {};
  let filled = 0;

  const name = String(get(inputs, "company.name") ?? "").trim();
  if (name) filled++;

  if (totalCapex(inputs) > 0) filled++;

  const cap = Number(get(inputs, "operations.capacityPerMinute") ?? 0);
  const ppm = Number(get(inputs, "operations.packagesPerMinute") ?? 0);
  if (cap > 0 || ppm > 0) filled++;

  if (Number(get(inputs, "operations.salePrice") ?? 0) > 0) filled++;

  if (Number(get(inputs, "operations.workingDaysPerYear") ?? 0) > 0) filled++;

  const waste = get(inputs, "operations.wasteRate") as { value?: number; maxAllowed?: number } | undefined;
  const wasteVal = Number(waste?.value ?? 0);
  const wasteMax = Number(waste?.maxAllowed ?? 0.01);
  if (wasteVal >= 0 && wasteVal <= wasteMax) filled++;

  if (Number(get(inputs, "financing.equityRatio") ?? 0) > 0) filled++;

  const wc = inputs.workingCapital as Record<string, number> | undefined;
  if (wc && wc.clientPaymentDays >= 0 && wc.supplierPaymentDays >= 0) filled++;

  if (plan.results && Object.keys(plan.results).length > 0) filled++;

  const percent = Math.round((filled / REQUIRED_COUNT) * 100);
  return { percent: Math.min(100, percent), filled, total: REQUIRED_COUNT };
}

export function extractSector(plan: Plan): string {
  const inputs = plan.inputs || {};
  const legal = String(get(inputs, "company.legalForm") ?? "SARL");
  const name = String(get(inputs, "company.name") ?? "").trim();
  if (name.toLowerCase().includes("huile") || name.toLowerCase().includes("agro")) {
    return "Agroalimentaire";
  }
  if (legal === "SA") return "Grande entreprise";
  return "PME — Liasse Unique";
}
