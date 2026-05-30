"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPlans, type Plan } from "@/lib/api";
import { isApiHttpError } from "@/lib/api-errors";
import {
  fetchKpiDashboard,
  type KpiDashboardProjection,
} from "@/lib/finance/kpi-api";

function pickValidatedPlan(
  plans: Plan[],
  preferredId?: string | null
): Plan | null {
  const validated = plans.filter((p) => p.status === "VALIDATED");
  if (preferredId) {
    const match = validated.find((p) => p.id === preferredId);
    if (match) return match;
  }
  return validated[0] ?? null;
}

export function useFinanceCockpitKpis(preferredPlanId?: string | null) {
  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: listPlans,
  });

  const validatedPlans = useMemo(
    () => (plansQuery.data ?? []).filter((p) => p.status === "VALIDATED"),
    [plansQuery.data]
  );

  const plan = useMemo(
    () =>
      plansQuery.data
        ? pickValidatedPlan(plansQuery.data, preferredPlanId)
        : null,
    [plansQuery.data, preferredPlanId]
  );

  const kpisQuery = useQuery({
    queryKey: ["plan-kpis", plan?.id, "base"] as const,
    queryFn: async (): Promise<KpiDashboardProjection | null> => {
      if (!plan?.id) return null;
      try {
        return await fetchKpiDashboard(plan.id, "base");
      } catch (e) {
        if (isApiHttpError(e, 404)) return null;
        throw e;
      }
    },
    enabled: Boolean(plan?.id),
  });

  const isLoading =
    plansQuery.isLoading || (Boolean(plan?.id) && kpisQuery.isLoading);

  const isEmpty =
    !plansQuery.isLoading &&
    !plansQuery.isError &&
    (validatedPlans.length === 0 ||
      !plan ||
      (!kpisQuery.isLoading && !kpisQuery.isError && kpisQuery.data === null));

  const error =
    plansQuery.error ??
    (kpisQuery.error instanceof Error ? kpisQuery.error : null);

  return {
    plan,
    validatedPlans,
    kpis: kpisQuery.data ?? null,
    isLoading,
    isEmpty,
    error,
    refetchKpis: kpisQuery.refetch,
    isFetchingKpis: kpisQuery.isFetching,
  };
}
