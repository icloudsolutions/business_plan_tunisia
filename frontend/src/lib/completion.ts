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

/** Map field path → wizard step for deep-link navigation */
export function fieldPathToStep(path: string): WizardStepId {
  if (path.startsWith("company")) return "general";
  if (path.startsWith("investments")) return "investments";
  if (path.startsWith("financing")) return "financing";
  if (path.startsWith("operations")) return "operations";
  if (path.startsWith("plAssumptions.personnel") || path.startsWith("plAssumptions.other")) {
    return "hr";
  }
  if (
    path.startsWith("workingCapital") ||
    path.startsWith("plAssumptions")
  ) {
    return "financial";
  }
  return "general";
}

export function sectionById(
  completion: PlanCompletion | null,
  section: WizardStepId
): SectionCompletion | undefined {
  return completion?.sections.find((s) => s.section === section);
}
