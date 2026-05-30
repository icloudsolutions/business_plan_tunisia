"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VersionDiffItem } from "@/lib/history-api";

const KIND_STYLES: Record<VersionDiffItem["kind"], string> = {
  added: "bg-emerald-50 text-emerald-800 border-emerald-200",
  removed: "bg-red-50 text-red-800 border-red-200",
  changed: "bg-amber-50 text-amber-900 border-amber-200",
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
  const t = useTranslations("history");

  const kindLabel = (kind: VersionDiffItem["kind"]) => {
    if (kind === "added") return t("added");
    if (kind === "removed") return t("removed");
    return t("changed");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 bg-navy-800 px-4 py-3 text-white">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">
              {t("compareTitle", { n: versionNumber })}
            </p>
            <p className="mt-0.5 text-xs text-navy-200">
              {t("diffCount", { count: changes.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="btn shrink-0 border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("back")}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
        {changes.length === 0 ? (
          <p className="rounded-lg bg-navy-50 px-3 py-4 text-center text-sm text-navy-600">
            {t("noDiff")}
          </p>
        ) : (
          <ul className="space-y-2">
            {changes.map((c) => (
              <li
                key={`${c.path}-${c.kind}`}
                className="rounded-lg border border-navy-100 bg-white p-3 text-xs shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] text-navy-800">
                    {c.path}
                  </code>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_STYLES[c.kind]}`}
                  >
                    {kindLabel(c.kind)}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase text-navy-500">
                      {t("savedVersion")}
                    </p>
                    <p
                      className={`break-all rounded px-2 py-1 text-navy-800 ${
                        c.kind === "removed"
                          ? "bg-red-50/80 line-through decoration-red-300/60"
                          : "bg-navy-50/80"
                      }`}
                    >
                      {truncate(c.old_value)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase text-navy-500">
                      {t("current")}
                    </p>
                    <p
                      className={`break-all rounded px-2 py-1 font-medium text-navy-900 ${
                        c.kind === "added"
                          ? "bg-emerald-50/80"
                          : c.kind === "changed"
                            ? "bg-emerald-50/80"
                            : "bg-navy-50/80"
                      }`}
                    >
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
