import { getToken } from "./auth-storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/** @deprecated Prefer `createAdminUser` from `@/lib/admin-api` (JWT admin). */
export async function createLegacyExpert(
  email: string,
  password: string,
  adminApiKey: string
): Promise<{ id: string; email: string; role: string }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/auth/admin/experts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminApiKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err);
    throw new Error(detail);
  }
  return res.json();
}
