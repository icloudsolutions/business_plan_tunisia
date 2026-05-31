import { api } from "@/lib/api";

export type TemplateSummary = {
  id: string;
  code?: string | null;
  name: string;
  version: string;
  secteur: string;
  sous_secteur: string;
  type_entreprise: string;
  type_financement: string;
  document_type: string;
  usage_count: number;
  is_public: boolean;
  hypotheses_preview: {
    taux_marge_brute_pct?: number;
    taux_croissance_ca_annuel_pct?: number;
    taux_interet_CMT_pct?: number;
    investissement_DT?: number;
  };
};

export type SousSecteurOption = { id: string; label: string };

export type SecteurTaxonomy = {
  id: string;
  label: string;
  code_TIA?: string;
  avantages_fiscaux?: string[];
  sous_secteurs: SousSecteurOption[];
};

export type PlanFromTemplateResponse = {
  plan_id: string;
  pre_filled_data: Record<string, unknown>;
};

export async function fetchTemplatesTaxonomy(): Promise<{ secteurs: SecteurTaxonomy[] }> {
  return api("/templates/taxonomy");
}

export async function listDocumentTemplates(params: {
  secteur?: string;
  sous_secteur?: string;
  type_entreprise?: string;
  type_financement?: string;
}): Promise<TemplateSummary[]> {
  const q = new URLSearchParams();
  if (params.secteur) q.set("secteur", params.secteur);
  if (params.sous_secteur) q.set("sous_secteur", params.sous_secteur);
  if (params.type_entreprise) q.set("type_entreprise", params.type_entreprise);
  if (params.type_financement) q.set("type_financement", params.type_financement);
  const qs = q.toString();
  return api(`/templates${qs ? `?${qs}` : ""}`);
}

export async function createPlanFromTemplate(body: {
  template_id: string;
  plan_name: string;
  project_description?: string;
}): Promise<PlanFromTemplateResponse> {
  return api("/plans/from-template", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createBlankPlan(title?: string) {
  return api<{ id: string; title: string }>("/plans", {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export type AdminTemplateRow = TemplateSummary & {
  hypotheses: Record<string, unknown>;
  is_active: boolean;
  description?: string | null;
};

export async function adminListTemplates(params?: {
  secteur?: string;
  sous_secteur?: string;
}): Promise<AdminTemplateRow[]> {
  const q = new URLSearchParams();
  if (params?.secteur) q.set("secteur", params.secteur);
  if (params?.sous_secteur) q.set("sous_secteur", params.sous_secteur);
  const qs = q.toString();
  return api(`/admin/templates${qs ? `?${qs}` : ""}`);
}

export async function adminTemplateStats(): Promise<{
  by_secteur: { secteur: string; count: number; total_usage: number }[];
  top_templates: TemplateSummary[];
}> {
  return api("/admin/templates/stats");
}

export async function adminPatchTemplate(
  id: string,
  body: { is_active?: boolean; is_public?: boolean }
): Promise<AdminTemplateRow> {
  return api(`/admin/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function adminTemplatesCsvUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  return `${base}/admin/templates/export.csv`;
}
