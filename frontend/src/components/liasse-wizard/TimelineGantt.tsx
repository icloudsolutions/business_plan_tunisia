"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { GanttPhaseRow, TimelineMilestone } from "@/lib/timeline-api";

type Props = {
  phases: GanttPhaseRow[];
  milestones: TimelineMilestone[];
  horizonMonths: number;
  planStartDate: string;
  readOnly?: boolean;
  onPhaseDatesChange: (phaseId: string, startDate: string, endDate: string) => void;
};

const LABEL_W_DESKTOP = 200;
const LABEL_W_MOBILE = 88;
const PX_PER_MONTH_DESKTOP = 44;
const PX_PER_MONTH_MOBILE = 28;
const ROW_H = 40;

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function monthToStartDate(planStart: string, month: number): string {
  if (month <= 1) return planStart;
  return addMonthsIso(planStart, Math.floor(month) - 1);
}

function monthToEndDate(planStart: string, month: number): string {
  const next = addMonthsIso(planStart, Math.ceil(month));
  const d = new Date(next + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function TimelineGantt({
  phases,
  milestones,
  horizonMonths,
  planStartDate,
  readOnly,
  onPhaseDatesChange,
}: Props) {
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const labelW = isNarrow ? LABEL_W_MOBILE : LABEL_W_DESKTOP;
  const pxPerMonth = isNarrow ? PX_PER_MONTH_MOBILE : PX_PER_MONTH_DESKTOP;
  const plotW = horizonMonths * pxPerMonth;
  const [drag, setDrag] = useState<{
    id: string;
    edge: "start" | "end";
    startMonth: number;
    endMonth: number;
  } | null>(null);
  const [preview, setPreview] = useState<Record<string, { sm: number; em: number }>>({});
  const plotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const monthFromEvent = useCallback(
    (phaseId: string, clientX: number) => {
      const el = plotRefs.current[phaseId];
      if (!el) return 1;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const m = 1 + (x / rect.width) * horizonMonths;
      return Math.max(1, Math.min(horizonMonths, m));
    },
    [horizonMonths]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const m = monthFromEvent(drag.id, e.clientX);
      let sm = drag.startMonth;
      let em = drag.endMonth;
      if (drag.edge === "start") sm = Math.min(m, em - 0.2);
      else em = Math.max(m, sm + 0.2);
      setPreview((p) => ({ ...p, [drag.id]: { sm, em } }));
    },
    [drag, monthFromEvent]
  );

  const commitDrag = useCallback(() => {
    if (!drag) return;
    const pv = preview[drag.id];
    const sm = pv?.sm ?? drag.startMonth;
    const em = pv?.em ?? drag.endMonth;
    onPhaseDatesChange(
      drag.id,
      monthToStartDate(planStartDate, sm),
      monthToEndDate(planStartDate, em)
    );
    setPreview((p) => {
      const next = { ...p };
      delete next[drag.id];
      return next;
    });
    setDrag(null);
  }, [drag, preview, onPhaseDatesChange, planStartDate]);

  const monthTicks = useMemo(
    () => Array.from({ length: horizonMonths }, (_, i) => i + 1),
    [horizonMonths]
  );

  return (
    <div
      className="overflow-x-auto rounded-lg border border-navy-100 bg-white"
      onPointerMove={onPointerMove}
      onPointerUp={() => commitDrag()}
      onPointerLeave={() => commitDrag()}
    >
      <div style={{ width: labelW + plotW, minWidth: "100%" }}>
        <div className="flex border-b border-navy-100 bg-navy-50/80">
          <div style={{ width: labelW }} className="shrink-0 px-2 py-2 text-xs font-semibold text-navy-600">
            Phase
          </div>
          <div className="relative shrink-0" style={{ width: plotW, height: 28 }}>
            {monthTicks.map((m) => (
              <span
                key={m}
                className="absolute top-2 -translate-x-1/2 text-[10px] text-navy-500"
                style={{ left: ((m - 0.5) / horizonMonths) * plotW }}
              >
                M{m}
              </span>
            ))}
          </div>
        </div>

        {phases.map((p) => {
          const pv = p.id ? preview[p.id] : undefined;
          const sm = pv?.sm ?? p.start_month;
          const em = pv?.em ?? p.end_month;
          const leftPct = ((sm - 1) / horizonMonths) * 100;
          const widthPct = ((em - sm) / horizonMonths) * 100;
          return (
            <div key={p.id ?? p.name} className="flex border-b border-navy-50" style={{ height: ROW_H }}>
              <div
                style={{ width: labelW }}
                className="flex shrink-0 items-center truncate px-1.5 text-xs font-medium text-navy-800 sm:px-2"
                title={p.name}
              >
                {p.name}
              </div>
              <div
                ref={(el) => {
                  if (p.id) plotRefs.current[p.id] = el;
                }}
                className="relative shrink-0"
                style={{ width: plotW }}
              >
                {milestones.map((ms) => (
                  <div
                    key={`${p.id}-${ms.key}`}
                    className="pointer-events-none absolute inset-y-1 z-10 border-l-2 border-dashed border-red-500"
                    style={{ left: `${((ms.month_index - 1) / horizonMonths) * 100}%` }}
                    title={ms.label}
                  />
                ))}
                <div
                  className="absolute top-2 rounded-md shadow-sm"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 1.5)}%`,
                    height: ROW_H - 16,
                    backgroundColor: p.color,
                  }}
                />
                {!readOnly && p.id && (
                  <>
                    <div
                      className="absolute top-2 z-20 h-6 w-2 cursor-ew-resize rounded-s bg-navy-900/50"
                      style={{ left: `${leftPct}%` }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDrag({
                          id: p.id!,
                          edge: "start",
                          startMonth: sm,
                          endMonth: em,
                        });
                      }}
                    />
                    <div
                      className="absolute top-2 z-20 h-6 w-2 cursor-ew-resize rounded-e bg-navy-900/50"
                      style={{ left: `calc(${leftPct}% + ${widthPct}% - 4px)` }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDrag({
                          id: p.id!,
                          edge: "end",
                          startMonth: sm,
                          endMonth: em,
                        });
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-navy-100 px-3 py-2 text-[10px] text-navy-600">
        {milestones.map((ms) => (
          <span key={ms.key}>
            ◆ {ms.label} ({ms.date})
          </span>
        ))}
      </div>
    </div>
  );
}
