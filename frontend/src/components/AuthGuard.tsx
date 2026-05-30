"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { userHasRole, type AppRole } from "@/lib/auth-roles";

export default function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles && !userHasRole(user.role, roles)) {
      router.replace("/");
    }
  }, [user, loading, roles, router]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-hidden />
        <p>Chargement…</p>
      </div>
    );
  }

  if (!user) return null;
  if (roles && !userHasRole(user.role, roles)) return null;

  return <>{children}</>;
}
