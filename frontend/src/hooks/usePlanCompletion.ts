"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlanCompletion, type PlanCompletion } from "@/lib/completion";

const DEBOUNCE_MS = 400;

export function usePlanCompletion(planId: string | undefined, refreshKey = 0) {
  const [completion, setCompletion] = useState<PlanCompletion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchPlanCompletion(planId);
      setCompletion(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur complétion");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [refresh, refreshKey]);

  return { completion, loading, error, refresh };
}
