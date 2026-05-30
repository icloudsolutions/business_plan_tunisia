import { api, pollJob, type JobStatus } from "@/lib/api";

export type ScenarioKey = "base" | "pessimistic" | "optimistic" | "custom";

export type PlYearRow = {
  year: number;
  revenue: number;
  cogs: number;
  personnel: number;
  otherOpex: number;
  distribution: number;
  marketing: number;
  vat: number;
  depreciation: number;
  interest: number;
  tax: number;
  totalExpenses: number;
  netProfit: number;
  ebe: number;
  grossMarginPct: number;
  operatingCashFlow: number;
  cumulativeTreasury: number;
  principalRepayment?: number;
};

export type ProjectionPayload = {
  scenario: string;
  multipliers: Record<string, number>;
  hasResults: boolean;
  pl: PlYearRow[];
  treasuryWaterfall: { step: string; value: number; type: string }[];
  investments: { name: string; value: number; category: string }[];
  investmentDetails: { name: string; value: number; category: string }[];
  kpis: {
    van: number;
    tri: number | null;
    drci: number | null;
    pointMort: number | null;
    grossMarginPct: number;
    ebe: number;
    totalInvestment: number;
    trends: Record<string, number | null>;
  };
  series: Record<string, number[]>;
};

export type ProjectionsResponse = {
  plan_id: string;
  plan_title: string;
  plan_status: string;
  has_results: boolean;
  scenario: string;
  active: ProjectionPayload | null;
  scenarios: Record<string, ProjectionPayload> | null;
};

export async function fetchProjections(
  planId: string,
  opts?: {
    scenario?: string;
    revenueMult?: number;
    growthMult?: number;
    loanRateMult?: number;
  }
): Promise<ProjectionsResponse> {
  const q = new URLSearchParams();
  q.set("scenario", opts?.scenario ?? "all");
  if (opts?.revenueMult != null) q.set("revenue_mult", String(opts.revenueMult));
  if (opts?.growthMult != null) q.set("growth_mult", String(opts.growthMult));
  if (opts?.loanRateMult != null) q.set("loan_rate_mult", String(opts.loanRateMult));
  return api(`/plans/${planId}/projections?${q}`);
}

export async function simulateProjections(
  planId: string,
  body: {
    revenue_year1_mult: number;
    growth_mult: number;
    loan_rate_mult: number;
    persist?: boolean;
  }
) {
  return api<{ id: string; status: string; task_type: string }>(
    `/plans/${planId}/projections/simulate`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function pollCalcJob(
  jobId: string,
  onStatus?: (s: string) => void
): Promise<JobStatus> {
  return pollJob(jobId, onStatus, 90);
}

export async function getExportStatus(planId: string, jobId: string) {
  return api<{
    id: string;
    status: string;
    formats: string[];
    files: Record<string, string>;
  }>(`/plans/${planId}/exports/${jobId}`);
}

export async function pollExportJob(
  planId: string,
  jobId: string,
  onStatus?: (s: string) => void,
  intervalMs = 3000,
  maxAttempts = 40
): Promise<{ status: string; formats: string[] }> {
  for (let i = 0; i < maxAttempts; i++) {
    const j = await getExportStatus(planId, jobId);
    onStatus?.(j.status);
    if (j.status === "COMPLETED") {
      return { status: j.status, formats: j.formats ?? ["pdf", "xlsx"] };
    }
    if (j.status === "FAILED") throw new Error("Export échoué");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Délai export dépassé");
}

export function formatTnd(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (compact && Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k`;
  return n.toLocaleString("fr-TN", { maximumFractionDigits: 0 });
}

export function formatPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)} %`;
}
