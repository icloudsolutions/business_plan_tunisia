/** Responsive grid for KPI / summary card rows (1 → 2 → 4 columns). */
export const KPI_SUMMARY_GRID =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";

/** Same breakpoints, up to 3 columns at lg (financing year cards). */
export const KPI_SUMMARY_GRID_UP_TO_3 =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

export const KPI_CARD_SHELL =
  "min-h-0 overflow-hidden rounded-xl border border-navy-100/80 bg-white p-4 shadow-sm sm:p-5";

export const KPI_CARD_ICON = "h-6 w-6 shrink-0 sm:h-8 sm:w-8";

export const KPI_CARD_LABEL =
  "truncate text-xs font-semibold uppercase tracking-wide text-navy-500";

export const KPI_CARD_VALUE =
  "truncate font-display text-xl font-bold tabular-nums tracking-tight text-navy-900 sm:text-2xl";

export const KPI_CARD_HINT = "truncate text-xs text-navy-500";
