"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { userHasRole, type AppRole } from "@/lib/auth-roles";

export type RoleGateProps = {
  role: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
  /** When set, unauthorized users are sent here instead of seeing `fallback`. */
  redirect?: string;
};

/**
 * Renders `children` only when `user.role` (from `useAuth()`) is in `role`.
 */
export default function RoleGate({
  role: allowedRoles,
  children,
  fallback = null,
  redirect,
}: RoleGateProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = userHasRole(user?.role, allowedRoles);

  useEffect(() => {
    if (loading || allowed || !redirect) return;
    router.replace(redirect);
  }, [loading, allowed, redirect, router]);

  if (loading) return null;
  if (!allowed) {
    if (redirect) return null;
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
