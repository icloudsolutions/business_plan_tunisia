"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import TimelineGantt from "@/components/liasse-wizard/TimelineGantt";
import {
  downloadGanttSvg,
  fetchTimeline,
  resetTimelineDefaults,
  updateTimelinePhase,
  updateTimelineSettings,
  type TimelineProjection,
} from "@/lib/timeline-api";

type Props = { planId: string; readOnly?: boolean };

export default function StepTimeline({ planId, readOnly }: Props) {
  const [data, setData] = useState<TimelineProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchTimeline(planId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement planning");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onStartupDelay = async (days: number) => {
    if (readOnly) return;
    setSaving(true);
    try {
      await updateTimelineSettings(planId, { startup_delay_days: days });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const onHorizon = async (months: number) => {
    if (readOnly) return;
    setSaving(true);
    try {
      await updateTimelineSettings(planId, { horizon_months: months });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const onPhaseDates = async (phaseId: string, startDate: string, endDate: string) => {
    if (readOnly) return;
    try {
      await updateTimelinePhase(planId, phaseId, {
        start_date: startDate,
        end_date: endDate,
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((p) =>
            p.id === phaseId ? { ...p, start_date: startDate, end_date: endDate } : p
          ),
        };
      });
      const refreshed = await fetchTimeline(planId);
      setData(refreshed);
    } catch {
      await load();
    }
  };

  const handleReset = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      setData(await resetTimelineDefaults(planId));
    } finally {
      setSaving(false);
    }
  };

  const exportSvg = async () => {
    try {
      await downloadGanttSvg(planId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export échoué");
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12 text-navy-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!data) return null;

  const chart = data.chart;
  const factorPct = (data.y1_revenue_factor * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-navy-900">Planning de réalisation</h3>
        <p className="mt-1 text-xs text-navy-600">
          Calendrier de mise en œuvre du projet · les dates alimentent le prorata de CA en année 1.
        </p>
      </section>

      <div className="flex flex-wrap items-end gap-6 rounded-lg border border-gold-100 bg-gold-50/50 p-4">
        <label className="block text-sm">
          <span className="font-medium text-navy-800">Délai de démarrage</span>
          <span className="ms-2 text-navy-600">(jours avant première vente)</span>
          <input
            type="number"
            min={0}
            max={365}
            disabled={readOnly}
            className="mt-1 block w-28 rounded border border-navy-200 px-3 py-2 text-sm"
            value={data.settings.startup_delay_days}
            onChange={(e) => void onStartupDelay(Number(e.target.value))}
          />
        </label>
        <p className="text-xs text-navy-700">
          Impact CA Y1 : <strong>{factorPct} %</strong> d&apos;une année pleine
          {data.settings.startup_delay_days === 90 && " (ex. 275/365 j)"}
        </p>
        <label className="block text-sm">
          <span className="font-medium text-navy-800">Horizon (mois)</span>
          <select
            disabled={readOnly}
            className="mt-1 block rounded border border-navy-200 px-2 py-2 text-sm"
            value={data.settings.horizon_months}
            onChange={(e) => void onHorizon(Number(e.target.value))}
          >
            {[12, 15, 18, 24].map((m) => (
              <option key={m} value={m}>
                {m} mois
              </option>
            ))}
          </select>
        </label>
      </div>

      <TimelineGantt
        phases={chart.phases}
        milestones={chart.milestones}
        horizonMonths={chart.horizon_months}
        planStartDate={chart.plan_start_date}
        readOnly={readOnly}
        onPhaseDatesChange={onPhaseDates}
      />

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-700 hover:bg-navy-50"
          >
            <RefreshCw className="h-4 w-4" />
            Réinitialiser phases par défaut
          </button>
        )}
        <button
          type="button"
          onClick={exportSvg}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-3 py-2 text-sm text-white hover:bg-navy-900"
        >
          <Download className="h-4 w-4" />
          Exporter Gantt (SVG / PDF)
        </button>
      </div>

      {saving && <p className="text-xs text-navy-500">Enregistrement…</p>}
    </div>
  );
}
