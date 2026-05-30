import { api } from "./api";
import { getToken } from "./auth-storage";
import type { WizardStepId } from "@/lib/liasse-wizard/schema";

export type CompletionFieldItem = {
  path: string;
  section: string;
  tier: string;
  label_fr: string;
  label_ar: string;
  filled: boolean;
};

export type SectionCompletion = {
  section: string;
  title_fr: string;
  title_ar: string;
  score_pct: number;
  status: "complete" | "warning" | "incomplete";
  required_missing: string[];
  recommended_missing: string[];
  fields_total: number;
  fields_filled: number;
};

export type PlanCompletion = {
  overall_pct: number;
  sections: SectionCompletion[];
  required_missing: CompletionFieldItem[];
  recommended_missing: CompletionFieldItem[];
  can_submit: boolean;
  milestones_reached: number[];
  scored_fields_total: number;
  scored_fields_filled: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function fetchPlanCompletion(planId: string): Promise<PlanCompletion> {
  return api(`/plans/${planId}/completion`);
}

export async function downloadCompletenessReport(planId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/plans/${planId}/completion/report.pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Téléchargement du rapport impossible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `completude-plan-${planId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

const LIASSE_INPUT_API_SECTIONS = [
  "general",
  "investments",
  "financing",
  "operations",
  "financial",
] as const;

/** Map field path → wizard step for deep-link navigation */
export function fieldPathToStep(path: string): WizardStepId {
  if (path.startsWith("company")) return "liasseInputs";
  if (path.startsWith("investments")) return "liasseInputs";
  if (
    path.startsWith("financing.equity") ||
    path.startsWith("financing.debt") ||
    path.startsWith("financing.loan")
  ) {
    return "liasseInputs";
  }
  if (path.startsWith("financing")) return "financing";
  if (path.startsWith("operations")) return "liasseInputs";
  if (path.startsWith("timeline")) return "timeline";
  if (path.startsWith("procurement") || path.startsWith("rawMaterial")) {
    return "procurement";
  }
  if (path.startsWith("products")) return "products";
  if (path.startsWith("pricing")) return "pricing";
  if (path.startsWith("productionCosts") || path.startsWith("cost.")) {
    return "productionCosts";
  }
  if (path.startsWith("payroll") || path.startsWith("plAssumptions.personnel")) {
    return "hr";
  }
  if (
    path.startsWith("otherCharges") ||
    path === "plAssumptions.otherOperatingCharges"
  ) {
    return "otherCharges";
  }
  if (path.startsWith("tva")) return "tva";
  if (path.startsWith("workingCapital") || path.startsWith("plAssumptions")) {
    return "liasseInputs";
  }
  return "liasseInputs";
}

export function sectionById(
  completion: PlanCompletion | null,
  section: WizardStepId
): SectionCompletion | undefined {
  if (!completion) return undefined;
  if (section === "liasseInputs") {
    const parts = LIASSE_INPUT_API_SECTIONS.map((key) =>
      completion.sections.find((s) => s.section === key)
    ).filter((s): s is SectionCompletion => s != null);
    if (!parts.length) return undefined;

    let fields_filled = 0;
    let fields_total = 0;
    const required_missing: string[] = [];
    const recommended_missing: string[] = [];
    for (const p of parts) {
      fields_filled += p.fields_filled;
      fields_total += p.fields_total;
      required_missing.push(...p.required_missing);
      recommended_missing.push(...p.recommended_missing);
    }
    const score_pct =
      fields_total > 0 ? Math.round((fields_filled / fields_total) * 100) : 0;
    let status: SectionCompletion["status"] = "incomplete";
    if (score_pct >= 100 && required_missing.length === 0) status = "complete";
    else if (required_missing.length === 0) status = "warning";

    return {
      section: "liasseInputs",
      title_fr: "Données liasse",
      title_ar: "",
      score_pct,
      status,
      required_missing,
      recommended_missing,
      fields_total,
      fields_filled,
    };
  }
  return completion.sections.find((s) => s.section === section);
}
