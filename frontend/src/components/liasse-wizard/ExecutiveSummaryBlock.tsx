"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { requestAiAssist } from "@/lib/ai-assist";

type Props = {
  planId: string;
  sector: string;
  companyType: "PME" | "GE";
  location: string;
  readOnly?: boolean;
};

export default function ExecutiveSummaryBlock({
  planId,
  sector,
  companyType,
  location,
  readOnly,
}: Props) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await requestAiAssist(planId, {
        action: "executive_summary",
        sector,
        company_type: companyType,
        location,
      });
      setSummary(res.executive_summary || res.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-gold-200 bg-gradient-to-b from-gold-50/80 to-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-navy-900">
            <FileText className="h-5 w-5 text-gold-600" />
            Résumé exécutif
          </h3>
          <p className="mt-1 text-sm text-navy-600">
            Synthèse ~200 mots en français pour votre dossier APII / banque.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Générer un résumé exécutif
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {summary && (
        <div className="mt-4 rounded-lg border border-navy-100 bg-white p-4 text-sm leading-relaxed text-navy-800">
          {summary.split("\n").map((p, i) => (
            <p key={i} className={i > 0 ? "mt-2" : ""}>
              {p}
            </p>
          ))}
          <p className="mt-3 text-xs text-navy-400">
            Copiez ce texte dans votre note de présentation ou export Word.
          </p>
        </div>
      )}
    </div>
  );
}
