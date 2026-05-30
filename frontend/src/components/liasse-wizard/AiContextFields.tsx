"use client";

import { useLiasseAi } from "@/context/LiasseAiContext";

type Props = { readOnly?: boolean };

export default function AiContextFields({ readOnly }: Props) {
  const ctx = useLiasseAi();
  if (!ctx) return null;

  const inputClass =
    "mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 shadow-sm focus:border-gold-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:bg-navy-50";

  return (
    <div className="mb-6 rounded-xl border border-violet-100 bg-violet-50/40 p-4 sm:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
        Contexte pour l&apos;aide IA
      </p>
      <p className="mt-1 text-xs text-navy-600">
        Secteur, taille et localisation utilisés pour les suggestions et le résumé exécutif.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="ai-context-sector" className="text-xs font-medium text-navy-700">
            Secteur d&apos;activité
          </label>
          <input
            id="ai-context-sector"
            type="text"
            className={inputClass}
            value={ctx.sector}
            onChange={(e) => ctx.setSector(e.target.value)}
            disabled={readOnly}
            placeholder="ex. Boulangerie artisanale"
          />
        </div>
        <div>
          <label htmlFor="ai-context-company-type" className="text-xs font-medium text-navy-700">
            Type d&apos;entreprise
          </label>
          <select
            id="ai-context-company-type"
            className={inputClass}
            value={ctx.companyType}
            onChange={(e) => ctx.setCompanyType(e.target.value as "PME" | "GE")}
            disabled={readOnly}
          >
            <option value="PME">PME</option>
            <option value="GE">Grande entreprise</option>
          </select>
        </div>
        <div>
          <label htmlFor="ai-context-location" className="text-xs font-medium text-navy-700">
            Localisation
          </label>
          <input
            id="ai-context-location"
            type="text"
            className={inputClass}
            value={ctx.location}
            onChange={(e) => ctx.setLocation(e.target.value)}
            disabled={readOnly}
            placeholder="ex. Tunis, Ariana"
          />
        </div>
      </div>
    </div>
  );
}
