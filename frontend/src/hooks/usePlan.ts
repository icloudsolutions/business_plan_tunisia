"use client";

import { useEffect, useState } from "react";
import { getPlan, type Plan } from "@/lib/api";
import { useDashboardNav } from "@/context/DashboardNavContext";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPlanId(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolves plan title from dashboard context (when already on plan page) or fetches via API.
 */
export function usePlan(planId: string | null | undefined) {
  const { planTitle, planId: contextPlanId } = useDashboardNav();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleFromContext =
    planId && contextPlanId === planId && planTitle ? planTitle : null;

  useEffect(() => {
    if (!planId) {
      setPlan(null);
      setError(null);
      return;
    }
    if (titleFromContext) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void getPlan(planId)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur");
          setPlan(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [planId, titleFromContext]);

  const title = titleFromContext ?? plan?.title ?? null;

  return { plan, title, loading, error };
}
