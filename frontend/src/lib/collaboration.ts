import { api } from "./api";

export type PlanComment = {
  id: string;
  plan_id: string;
  field_key: string;
  user_id: string;
  user_email?: string | null;
  content: string;
  parent_id: string | null;
  resolved: boolean;
  created_at: string;
};

export type SectionReview = {
  id: string;
  plan_id: string;
  section_key: string;
  status: "approve" | "flag" | "reject";
  user_id: string;
  user_email?: string | null;
  updated_at: string;
};

export type PresenceUser = {
  user_id: string;
  email: string;
  role: string;
  color?: string;
};

export type ActivityItem = {
  source?: string;
  kind?: string;
  message: string;
  meta?: Record<string, unknown>;
  user_email?: string | null;
  created_at?: string;
};

export type CollaborationSync = {
  plan_status: string;
  comments: PlanComment[];
  section_reviews: SectionReview[];
  activity: ActivityItem[];
  presence: PresenceUser[];
};

export const WIZARD_SECTIONS = [
  { id: "general", label: "Informations générales" },
  { id: "investments", label: "Investissements" },
  { id: "financing", label: "Financement" },
  { id: "operations", label: "Exploitation" },
  { id: "hr", label: "Ressources humaines" },
  { id: "financial", label: "Indicateurs financiers" },
] as const;

export type SectionId = (typeof WIZARD_SECTIONS)[number]["id"];

export async function listPlanComments(planId: string): Promise<PlanComment[]> {
  return api(`/plans/${planId}/comments`);
}

export async function createPlanComment(
  planId: string,
  body: { field_key?: string; content: string; parent_id?: string | null }
): Promise<PlanComment> {
  return api(`/plans/${planId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchPlanComment(
  planId: string,
  commentId: string,
  body: { resolved?: boolean; content?: string }
): Promise<PlanComment> {
  return api(`/plans/${planId}/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listSectionReviews(planId: string): Promise<SectionReview[]> {
  return api(`/plans/${planId}/section-reviews`);
}

export async function upsertSectionReview(
  planId: string,
  sectionKey: string,
  status: "approve" | "flag" | "reject"
): Promise<SectionReview> {
  return api(`/plans/${planId}/section-reviews/${sectionKey}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function fetchCollaborationSync(planId: string): Promise<CollaborationSync> {
  return api(`/plans/${planId}/collaboration/sync`);
}

export async function fetchPlanActivity(planId: string, limit = 25): Promise<ActivityItem[]> {
  return api(`/plans/${planId}/activity?limit=${limit}`);
}

export function buildWsUrl(planId: string, token: string): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const base = process.env.NEXT_PUBLIC_WS_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/api/ws/plans/${planId}?token=${encodeURIComponent(token)}`;
  }
  return `${proto}//${window.location.host}/api/ws/plans/${planId}?token=${encodeURIComponent(token)}`;
}

export function threadsByField(comments: PlanComment[]): Map<string, PlanComment[][]> {
  const roots = comments.filter((c) => !c.parent_id);
  const byParent = new Map<string, PlanComment[]>();
  for (const c of comments) {
    if (!c.parent_id) continue;
    const list = byParent.get(c.parent_id) ?? [];
    list.push(c);
    byParent.set(c.parent_id, list);
  }
  const map = new Map<string, PlanComment[][]>();
  for (const root of roots) {
    const thread = [root, ...(byParent.get(root.id) ?? [])];
    const list = map.get(root.field_key) ?? [];
    list.push(thread);
    map.set(root.field_key, list);
  }
  return map;
}

export function unresolvedFieldKeys(comments: PlanComment[]): Set<string> {
  const keys = new Set<string>();
  for (const c of comments) {
    if (!c.parent_id && !c.resolved) keys.add(c.field_key);
  }
  return keys;
}
