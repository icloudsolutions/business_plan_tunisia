"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import AuthGuard from "@/components/AuthGuard";
import RoleGate from "@/components/auth/RoleGate";
import { createPlan } from "@/lib/api";

function NewPlanRedirect() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await createPlan(
          "Business Plan " + new Date().toLocaleDateString("fr-TN")
        );
        if (!cancelled) router.replace(`/plans/${p.id}`);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4">
      {error ? (
        <>
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/plans")}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            {t("backToPlans")}
          </button>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-navy-200 border-t-gold-500" />
          <p className="text-sm text-navy-600">{t("creatingPlan")}</p>
        </>
      )}
    </div>
  );
}

export default function NewPlanPage() {
  return (
    <AuthGuard>
      <RoleGate role={["client"]} redirect="/plans">
        <NewPlanRedirect />
      </RoleGate>
    </AuthGuard>
  );
}
