"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { SortDirection } from "./plan-list-utils";

type Props = {
  label: string;
  sortKey: string;
  activeKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  align?: "start" | "end";
  className?: string;
};

export default function SortableTableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "start",
  className = "",
}: Props) {
  const active = activeKey === sortKey;
  const ariaSort = active ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      className={`px-4 py-3 ${align === "end" ? "text-end" : "text-start"} ${className}`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-navy-800 ${
          align === "end" ? "ms-auto" : ""
        } ${active ? "text-navy-900" : "text-navy-500"}`}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-30" aria-hidden />
        )}
      </button>
    </th>
  );
}
