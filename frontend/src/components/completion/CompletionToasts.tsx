"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Sparkles } from "lucide-react";
import type { PlanCompletion } from "@/lib/completion";

type ToastItem = {
  id: string;
  title: string;
  body: string;
  kind: "section" | "milestone";
};

function storageKey(planId: string, suffix: string) {
  return `bp_completion_${planId}_${suffix}`;
}

export function useCompletionGamification(planId: string, completion: PlanCompletion | null) {
  const prevSections = useRef<Record<string, number>>({});
  const prevOverall = useRef<number | null>(null);

  useEffect(() => {
    if (!completion || !planId) return;

    for (const sec of completion.sections) {
      const prev = prevSections.current[sec.section];
      if (prev !== undefined && prev < 100 && sec.score_pct >= 100 && sec.status === "complete") {
        const shown = sessionStorage.getItem(storageKey(planId, `section_${sec.section}`));
        if (!shown) {
          sessionStorage.setItem(storageKey(planId, `section_${sec.section}`), "1");
          window.dispatchEvent(
            new CustomEvent("bp-completion-toast", {
              detail: {
                title: "Étape franchie !",
                body: `${sec.title_fr} est complète à 100 %.`,
                kind: "section",
              },
            })
          );
        }
      }
      prevSections.current[sec.section] = sec.score_pct;
    }

    const overall = completion.overall_pct;
    if (prevOverall.current !== null) {
      for (const m of [50, 100] as const) {
        if (prevOverall.current < m && overall >= m) {
          const key = storageKey(planId, `milestone_${m}`);
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            window.dispatchEvent(
              new CustomEvent("bp-completion-toast", {
                detail: {
                  title: m === 100 ? "Plan complet !" : "Mi-parcours atteint",
                  body:
                    m === 100
                      ? "Tous les champs évalués sont renseignés."
                      : "Votre dossier est complété à moitié.",
                  kind: "milestone",
                },
              })
            );
          }
        }
      }
    }
    prevOverall.current = overall;
  }, [completion, planId]);
}

export default function CompletionToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Omit<ToastItem, "id">;
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((t) => [...t, { ...detail, id }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4500);
    };
    window.addEventListener("bp-completion-toast", handler);
    return () => window.removeEventListener("bp-completion-toast", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed end-4 top-20 z-[80] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-gold-200 bg-white px-4 py-3 shadow-lg"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              t.kind === "milestone" ? "bg-gold-100 text-gold-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {t.kind === "milestone" ? (
              <Award className="h-5 w-5" aria-hidden />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold text-navy-900">{t.title}</p>
            <p className="text-xs text-navy-600">{t.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
