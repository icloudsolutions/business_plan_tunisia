"use client";

import {
  Building2,
  Factory,
  Leaf,
  Palette,
  ShoppingBag,
  Shirt,
  Stethoscope,
  Wheat,
  Wrench,
} from "lucide-react";
import type { TemplateSummary } from "@/lib/templates-api";

const SECTEUR_ICONS: Record<string, typeof Factory> = {
  INDUSTRIE_AGROALIMENTAIRE: Wheat,
  INDUSTRIE_TEXTILE: Shirt,
  INDUSTRIE_MECANIQUE: Wrench,
  SERVICES: Building2,
  AGRICULTURE: Leaf,
  ARTISANAT: Palette,
  BTP: Factory,
  COMMERCE: ShoppingBag,
};

const TYPE_BADGE: Record<string, string> = {
  PME: "bg-sky-100 text-sky-800",
  GE: "bg-violet-100 text-violet-800",
  STARTUP: "bg-amber-100 text-amber-800",
};

function fmtDt(n: number | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("fr-TN")} DT`;
}

type Props = {
  templates: TemplateSummary[];
  loading?: boolean;
  onSelect: (template: TemplateSummary) => void;
  selectedId?: string | null;
};

export default function TemplateSelector({
  templates,
  loading,
  onSelect,
  selectedId,
}: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-navy-100 bg-navy-50/50"
          />
        ))}
      </div>
    );
  }

  if (!templates.length) {
    return (
      <p className="rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-4 py-8 text-center text-sm text-navy-600">
        Aucun template pour ces critères. Essayez un autre secteur ou commencez sans
        template.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const Icon = SECTEUR_ICONS[t.secteur] ?? Factory;
        const preview = t.hypotheses_preview || {};
        const selected = selectedId === t.id;
        return (
          <article
            key={t.id}
            className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md ${
              selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-navy-100"
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-800 text-gold-400">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  TYPE_BADGE[t.type_entreprise] ?? "bg-navy-100 text-navy-700"
                }`}
              >
                {t.type_entreprise}
              </span>
            </div>
            <h3 className="font-display text-base font-semibold text-navy-900">{t.name}</h3>
            <p className="mt-1 text-xs text-navy-500">
              {t.secteur.replace(/_/g, " ")} · {t.sous_secteur.replace(/_/g, " ")}
            </p>
            <ul className="mt-3 flex-1 space-y-1 text-sm text-navy-700">
              <li>
                Marge brute :{" "}
                <strong>{preview.taux_marge_brute_pct ?? "—"}%</strong>
              </li>
              <li>
                Croissance CA :{" "}
                <strong>{preview.taux_croissance_ca_annuel_pct ?? "—"}%</strong>
              </li>
              <li>
                Investissement : <strong>{fmtDt(preview.investissement_DT)}</strong>
              </li>
              <li className="text-xs text-navy-500">
                {t.usage_count} utilisation{t.usage_count !== 1 ? "s" : ""}
              </li>
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-navy-800 px-3 py-2 text-sm font-medium text-white hover:bg-navy-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={() => onSelect(t)}
            >
              Utiliser ce template
            </button>
          </article>
        );
      })}
    </div>
  );
}

export function SecteurIcon({ secteur }: { secteur: string }) {
  const Icon = SECTEUR_ICONS[secteur] ?? Stethoscope;
  return <Icon className="h-4 w-4" aria-hidden />;
}
