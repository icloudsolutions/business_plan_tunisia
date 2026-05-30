import { api } from "./api";
import { getToken } from "./auth-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  display_name?: string | null;
  status: string;
  last_active_at?: string | null;
  created_at?: string;
  plans_count: number;
};

export type AdminPlan = {
  id: string;
  title: string;
  status: string;
  owner_id: string;
  owner_email: string;
  expert_id: string | null;
  expert_email: string | null;
  updated_at: string;
  completion_pct: number;
  export_status: string;
};

export type EmailDeliveryStats = {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  opened: number;
  openRatePct: number;
  byType: { type: string; count: number }[];
};

export type Analytics = {
  plansPerMonth: { month: string; count: number }[];
  stateDistribution: { state: string; count: number }[];
  avgTimePerState: { state: string; avgDays: number }[];
  expertWorkload: { expert_id: string; expert_email: string; plans_count: number }[];
  totalPlans: number;
  emailDelivery?: EmailDeliveryStats;
};

export type SystemHealth = {
  api: Record<string, string>;
  celery_queues: Record<string, number>;
  postgres_bytes: number;
  postgres_human: string;
};

export type NotificationTemplate = {
  key: string;
  title: string;
  body: string;
};

export async function listAdminUsers(): Promise<AdminUser[]> {
  return api("/admin/users");
}

export async function patchAdminUser(
  id: string,
  body: { role?: string; status?: string; display_name?: string }
): Promise<AdminUser> {
  return api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function createAdminUser(
  email: string,
  password: string,
  role: "client" | "expert"
): Promise<AdminUser> {
  return api("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function bulkResetPassword(userIds: string[]) {
  return api<{ reset: number }>("/admin/users/bulk-reset-password", {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export async function downloadUsersCsv(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/users/export.csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export CSV échoué");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function listAdminPlans(params?: {
  status?: string;
  expert_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<AdminPlan[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.expert_id) q.set("expert_id", params.expert_id);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString();
  return api(`/admin/plans${qs ? `?${qs}` : ""}`);
}

export async function adminSetPlanStatus(planId: string, status: string) {
  return api(`/admin/plans/${planId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function adminAssignExpert(planId: string, expertId: string) {
  return api(`/admin/plans/${planId}/expert`, {
    method: "PATCH",
    body: JSON.stringify({ expert_id: expertId }),
  });
}

export async function fetchAdminAnalytics(): Promise<Analytics> {
  return api("/admin/analytics");
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  return api("/admin/health");
}

export async function fetchAdminLogs(limit = 20): Promise<{ lines: string[] }> {
  return api(`/admin/logs?limit=${limit}`);
}

export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  return api("/admin/notification-templates");
}

export async function sendAdminNotification(body: {
  title: string;
  body: string;
  channel: "in_app" | "email" | "both";
  template_key?: string;
  user_id?: string;
  role_target?: "client" | "expert" | "admin";
}) {
  return api<{ sent: number }>("/admin/notifications", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
