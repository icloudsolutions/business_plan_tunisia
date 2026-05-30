import { api } from "./api";
import { getJob, type JobStatus } from "./api";

export type ScenarioMultipliers = {
  revenue_growth_by_year: number[];
  personnel_cost_growth: number;
  raw_material_cost_ratio: number;
  loan_interest_rate_mult: number;
  revenue_scale: number;
};

export type PlanScenario = {
  id: string;
  plan_id: string;
  name: string;
  slug: string | null;
  multipliers: ScenarioMultipliers;
  results: Record<string, unknown> | null;
  calc_job_id: string | null;
  calc_status: string;
  is_official: boolean;
  recommended_by_id: string | null;
};

export type ScenarioKpiRow = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  is_official: boolean;
  van: number | null;
  tri: number | null;
  drci: number | null;
  point_mort: number | null;
};

export type ScenarioCompare = {
  plan_id: string;
  official_scenario_id: string | null;
  kpi_table: ScenarioKpiRow[];
  net_profit_series: Record<string, number[]>;
  scenarios: PlanScenario[];
};

export const SCENARIO_COLORS: Record<string, string> = {
  pessimiste: "#ef4444",
  pessimistic: "#ef4444",
  base: "#64748b",
  optimiste: "#10b981",
  optimistic: "#10b981",
};

export async function listScenarios(planId: string): Promise<PlanScenario[]> {
  return api(`/plans/${planId}/scenarios`);
}

export async function compareScenarios(planId: string): Promise<ScenarioCompare> {
  return api(`/plans/${planId}/scenarios/compare`);
}

export async function createScenario(
  planId: string,
  name: string,
  multipliers?: Partial<ScenarioMultipliers>
): Promise<PlanScenario> {
  return api(`/plans/${planId}/scenarios`, {
    method: "POST",
    body: JSON.stringify({ name, multipliers }),
  });
}

export async function updateScenario(
  planId: string,
  scenarioId: string,
  body: { name?: string; multipliers?: ScenarioMultipliers; recalculate?: boolean }
): Promise<PlanScenario> {
  return api(`/plans/${planId}/scenarios/${scenarioId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function calculateScenario(planId: string, scenarioId: string) {
  return api<{ id: string; status: string }>(`/plans/${planId}/scenarios/${scenarioId}/calculate`, {
    method: "POST",
  });
}

export async function calculateAllScenarios(planId: string) {
  return api<{ id: string; status: string }[]>(`/plans/${planId}/scenarios/calculate-all`, {
    method: "POST",
  });
}

export async function setOfficialScenario(planId: string, scenarioId: string) {
  return api<PlanScenario>(`/plans/${planId}/scenarios/${scenarioId}/set-official`, {
    method: "POST",
  });
}

/** ~6 min at 1.5s — aligns with Celery task_time_limit (300s) + buffer */
const SCENARIO_POLL_ATTEMPTS = 240;
const SCENARIO_POLL_INTERVAL_MS = 1500;

export async function pollScenarioJob(jobId: string, onStatus?: (s: string) => void) {
  for (let i = 0; i < SCENARIO_POLL_ATTEMPTS; i++) {
    const j: JobStatus = await getJob(jobId);
    onStatus?.(j.status);
    if (j.status === "COMPLETED") return j;
    if (j.status === "FAILED") {
      throw new Error(j.error || "Calcul scénario échoué");
    }
    await new Promise((r) => setTimeout(r, SCENARIO_POLL_INTERVAL_MS));
  }
  const last = await getJob(jobId);
  if (last.status === "FAILED") {
    throw new Error(last.error || "Calcul scénario échoué");
  }
  if (last.status === "COMPLETED") return last;
  throw new Error(
    "Calcul scénario expiré (délai dépassé). Vérifiez le service worker : docker compose ps worker. " +
      "Sinon activez SCENARIO_CALC_SYNC=true sur l'API."
  );
}
