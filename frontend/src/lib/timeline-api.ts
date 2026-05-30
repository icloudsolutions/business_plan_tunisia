import { api } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";

export type TimelinePhaseType = "investment" | "startup" | "production" | "commercial";

export type GanttPhaseRow = {
  id: string | null;
  name: string;
  phase_type: TimelinePhaseType;
  color: string;
  start_month: number;
  end_month: number;
  start_date: string;
  end_date: string;
};

export type TimelineMilestone = {
  key: string;
  label: string;
  date: string;
  month_index: number;
};

export type TimelineProjection = {
  plan_id?: string;
  settings: {
    plan_id?: string;
    plan_start_date: string;
    startup_delay_days: number;
    horizon_months: number;
  };
  phases: {
    id?: string;
    name: string;
    start_date: string;
    end_date: string;
    phase_type: TimelinePhaseType;
    color: string;
    sort_order: number;
  }[];
  milestones: TimelineMilestone[];
  y1_revenue_factor: number;
  chart: {
    horizon_months: number;
    plan_start_date: string;
    startup_delay_days: number;
    y1_revenue_factor: number;
    phases: GanttPhaseRow[];
    milestones: TimelineMilestone[];
  };
};

export async function fetchTimeline(planId: string): Promise<TimelineProjection> {
  const res = await api<{ projection: TimelineProjection }>(`/plans/${planId}/timeline`);
  return res.projection;
}

export async function updateTimelineSettings(
  planId: string,
  body: { startup_delay_days?: number; horizon_months?: number; plan_start_date?: string }
): Promise<void> {
  await api(`/plans/${planId}/timeline/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function updateTimelinePhase(
  planId: string,
  phaseId: string,
  body: { start_date?: string; end_date?: string; name?: string }
): Promise<void> {
  await api(`/plans/${planId}/timeline/phases/${phaseId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function resetTimelineDefaults(planId: string): Promise<TimelineProjection> {
  const res = await api<{ projection: TimelineProjection }>(
    `/plans/${planId}/timeline/reset-defaults`,
    { method: "POST" }
  );
  return res.projection;
}

export async function downloadGanttSvg(planId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}/plans/${planId}/timeline/gantt.svg`, { headers });
  if (!res.ok) throw new Error("Export Gantt impossible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planning_${planId}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
