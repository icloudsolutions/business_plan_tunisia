const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bp_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err));
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Plan {
  id: string;
  title: string;
  status: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown> | null;
  locked_at: string | null;
}

export interface PlanPatchResult {
  plan: Plan;
  missingFields: string[];
}

export interface SimulationItem {
  id: string;
  name: string;
  deltaVsBaseline: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
}

export async function fetchMe(): Promise<User> {
  return api("/auth/me");
}

export async function login(email: string, password: string) {
  return api<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string) {
  return api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function listPlans(): Promise<Plan[]> {
  return api("/plans");
}

export async function createPlan(title: string): Promise<Plan> {
  return api("/plans", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function getPlan(id: string): Promise<Plan> {
  return api(`/plans/${id}`);
}

export async function saveInputs(id: string, inputs: Record<string, unknown>): Promise<PlanPatchResult> {
  return api(`/plans/${id}/inputs`, {
    method: "PATCH",
    body: JSON.stringify({ inputs }),
  });
}

export async function submitPlan(id: string): Promise<Plan> {
  return api(`/plans/${id}/submit`, { method: "POST" });
}

export async function recalculate(id: string) {
  return api<{ id: string; status: string }>(`/plans/${id}/recalculate`, { method: "POST" });
}

export async function getJob(id: string) {
  return api<{ id: string; status: string; result?: unknown; error?: string }>(`/jobs/${id}`);
}

export async function pollJob(
  id: string,
  onStatus?: (status: string) => void,
  maxAttempts = 60
): Promise<{ id: string; status: string; result?: unknown; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const j = await getJob(id);
    onStatus?.(j.status);
    if (j.status === "COMPLETED" || j.status === "FAILED") return j;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Délai dépassé en attente du calcul");
}

export async function runSimulation(
  id: string,
  patches: { path: string; multiplier?: number; value?: unknown }[],
  name: string
) {
  return api<{ id: string }>(`/plans/${id}/simulate`, {
    method: "POST",
    body: JSON.stringify({ name, patches }),
  });
}

export async function listSimulations(id: string): Promise<SimulationItem[]> {
  return api(`/plans/${id}/simulations`);
}

export async function auditPlan(id: string) {
  return api(`/plans/${id}/audit`, { method: "POST" });
}

export async function transitionPlan(id: string, action: string) {
  return api<Plan>(`/plans/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function exportPlan(id: string) {
  return api<{ id: string }>(`/plans/${id}/export`, {
    method: "POST",
    body: JSON.stringify({ formats: ["pdf", "xlsx"] }),
  });
}

export async function downloadExport(planId: string, jobId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/plans/${planId}/exports/${jobId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Téléchargement impossible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `business-plan-${planId}.${blob.type.includes("pdf") ? "pdf" : "xlsx"}`;
  a.click();
  URL.revokeObjectURL(url);
}
