import { ApiHttpError } from "./api-errors";
import { clearToken, getToken } from "./auth-storage";
import { locales, type AppLocale } from "@/i18n/routing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

export function loginPathForStoredLocale(): string {
  if (typeof localStorage === "undefined") return "/fr/login";
  const loc = localStorage.getItem("bp_locale") || "fr";
  const segment = isAppLocale(loc) ? loc : "fr";
  return `/${segment}/login`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    clearToken();
    const onLogin = /\/login\/?$/.test(window.location.pathname);
    if (!onLogin) {
      window.location.href = loginPathForStoredLocale();
    }
    throw new Error("Session expirée — reconnectez-vous");
  }

  if (!res.ok) {
    if (res.status === 503) {
      throw new Error(
        "Service temporairement indisponible — attendez quelques secondes et réessayez."
      );
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err);
    if (res.status === 429 || /limit/i.test(detail)) {
      throw new Error(
        "Trop de requêtes — patientez quelques secondes avant de réessayer."
      );
    }
    throw new ApiHttpError(detail, res.status);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export interface User {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
  preferred_locale?: AppLocale | string;
  timezone?: string | null;
  email_notifications_enabled?: boolean;
  created_at?: string;
}

export interface UserProfileUpdate {
  display_name?: string | null;
  preferred_locale?: AppLocale;
  timezone?: string | null;
  email_notifications_enabled?: boolean;
}

export interface PlanStatusHistoryEntry {
  status: string;
  changed_at: string;
  changed_by?: string | null;
}

export interface Plan {
  id: string;
  title: string;
  status: string;
  owner_id?: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown> | null;
  locked_at: string | null;
  created_at?: string;
  updated_at?: string;
  history?: PlanStatusHistoryEntry[];
}

export interface PlanPatchResult {
  plan: Plan;
  missingFields: string[];
}

export interface SimulationDelta {
  deltaVan?: number;
  deltaTri?: number | null;
  baselineTri?: number | null;
  scenarioTri?: number | null;
  baselineCashBreakYear?: number | null;
  scenarioCashBreakYear?: number | null;
  baselineVan?: number;
  scenarioVan?: number;
}

export interface SimulationItem {
  id: string;
  name: string;
  createdAt?: string;
  deltaVsBaseline: SimulationDelta | null;
  results: Record<string, unknown> | null;
}

export interface AuditResult {
  decision: string;
  checks: Record<string, boolean>;
  recommendations: string[];
  indicators?: Record<string, number | null>;
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

export async function register(
  email: string,
  password: string,
  preferred_locale?: AppLocale
) {
  return api<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, preferred_locale }),
  });
}

export async function updateProfile(body: UserProfileUpdate): Promise<User> {
  return api<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function listUsers(): Promise<User[]> {
  return api("/auth/admin/users");
}

export async function adminCreateUser(
  email: string,
  password: string,
  role: "client" | "expert"
): Promise<User> {
  return api("/auth/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function listPlans(): Promise<Plan[]> {
  return api("/plans");
}

export async function createPlan(title?: string): Promise<Plan> {
  return api("/plans", {
    method: "POST",
    body: JSON.stringify(title != null ? { title } : {}),
  });
}

export async function getPlan(id: string): Promise<Plan> {
  return api(`/plans/${id}`);
}

export async function updatePlan(id: string, title: string): Promise<Plan> {
  return api(`/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deletePlan(id: string): Promise<void> {
  await api(`/plans/${id}`, { method: "DELETE" });
}

export async function saveInputs(
  id: string,
  inputs: Record<string, unknown>
): Promise<PlanPatchResult> {
  return patchPlanInputs(id, inputs);
}

/** PATCH plan inputs with a partial diff (server merges into stored inputs). */
export async function patchPlanInputs(
  id: string,
  inputsPatch: Record<string, unknown>
): Promise<PlanPatchResult> {
  return api(`/plans/${id}/inputs`, {
    method: "PATCH",
    body: JSON.stringify({ inputs: inputsPatch }),
  });
}

/** Best-effort save on tab close / unmount (fetch keepalive). */
export function flushPlanInputs(
  id: string,
  inputsPatch: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  void fetch(`${API_BASE}/plans/${id}/inputs`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ inputs: inputsPatch }),
    keepalive: true,
  });
}

export async function submitPlan(id: string): Promise<Plan> {
  return api(`/plans/${id}/submit`, { method: "POST" });
}

export async function resubmitPlan(id: string): Promise<Plan> {
  return api(`/plans/${id}/resubmit`, { method: "POST" });
}

export async function recalculate(id: string) {
  return api<{ id: string; status: string }>(`/plans/${id}/recalculate`, {
    method: "POST",
  });
}

export async function getJob(id: string): Promise<JobStatus> {
  return api<JobStatus>(`/jobs/${id}`);
}

export interface JobStatus {
  id: string;
  status: string;
  task_type?: string;
  result?: {
    files?: Record<string, string>;
    formats?: string[];
    format?: string;
  };
  error?: string;
}

export async function pollJob(
  id: string,
  onStatus?: (status: string) => void,
  maxAttempts = 60
): Promise<JobStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const j = await getJob(id);
    onStatus?.(j.status);
    if (j.status === "COMPLETED") return j;
    if (j.status === "FAILED") {
      throw new Error(j.error || "Tâche échouée");
    }
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

export async function auditPlan(id: string): Promise<AuditResult> {
  return api(`/plans/${id}/audit`, { method: "POST" });
}

export async function transitionPlan(
  id: string,
  action: string,
  message?: string,
  options?: { acknowledgeAuditWarnings?: boolean }
) {
  return api<Plan>(`/plans/${id}/transition`, {
    method: "POST",
    body: JSON.stringify({
      action,
      message: message ?? null,
      acknowledge_audit_warnings: options?.acknowledgeAuditWarnings ?? false,
    }),
  });
}

export type ExportFormat = "pdf" | "xlsx" | "docx";

export async function exportPlan(
  id: string,
  formats: ExportFormat[] = ["pdf", "xlsx", "docx"]
) {
  return api<{ id: string }>(`/plans/${id}/export`, {
    method: "POST",
    body: JSON.stringify({ formats }),
  });
}

export async function downloadExport(
  planId: string,
  jobId: string,
  format: ExportFormat
): Promise<void> {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/plans/${planId}/exports/${jobId}/download?format=${format}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Téléchargement impossible");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    format === "docx"
      ? `etude-faisabilite-${planId}.docx`
      : `business-plan-${planId}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
