"use client";

import type { VersionDiffItem } from "@/lib/history-api";

const KIND_STYLES: Record<VersionDiffItem["kind"], string> = {
  added: "bg-emerald-50 text-emerald-800 border-emerald-200",
  removed: "bg-red-50 text-red-800 border-red-200",
  changed: "bg-amber-50 text-amber-900 border-amber-200",
};

const KIND_LABELS: Record<VersionDiffItem["kind"], string> = {
  added: "Ajouté",
  removed: "Supprimé",
  changed: "Modifié",
};

function truncate(val: string | null, max = 120): string {
  if (val == null) return "—";
  if (val.length <= max) return val;
  return `${val.slice(0, max)}…`;
}

type Props = {
  changes: VersionDiffItem[];
  versionNumber: number;
  onBack: () => void;
};

export default function VersionDiffView({ changes, versionNumber, onBack }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-navy-800">
            Comparaison — version {versionNumber}
          </p>
          <p className="text-xs text-navy-500">
            {changes.length} champ{changes.length !== 1 ? "s" : ""} différent
            {changes.length !== 1 ? "s" : ""} par rapport à l&apos;état actuel
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-gold-700 hover:text-gold-600"
        >
          Retour
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {changes.length === 0 ? (
          <p className="rounded-lg bg-navy-50 px-3 py-4 text-center text-sm text-navy-600">
            Aucune différence avec la version actuelle.
          </p>
        ) : (
          <ul className="space-y-2">
            {changes.map((c) => (
              <li
                key={`${c.path}-${c.kind}`}
                className="rounded-lg border border-navy-100 bg-white p-3 text-xs"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] text-navy-800">
                    {c.path}
                  </code>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_STYLES[c.kind]}`}
                  >
                    {KIND_LABELS[c.kind]}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase text-navy-500">
                      Version sauvegardée
                    </p>
                    <p className="break-all rounded bg-red-50/80 px-2 py-1 text-navy-800 line-through decoration-red-300/60">
                      {truncate(c.old_value)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase text-navy-500">
                      Actuel
                    </p>
                    <p className="break-all rounded bg-emerald-50/80 px-2 py-1 font-medium text-navy-900">
                      {truncate(c.new_value)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
