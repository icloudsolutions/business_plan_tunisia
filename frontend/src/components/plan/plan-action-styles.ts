import { FOCUS_RING } from "@/lib/a11y";

/** Shared Tailwind classes for plan workflow actions (one primary per screen state). */

const focus = FOCUS_RING;

export const btnPrimary =
  `inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-55 disabled:cursor-not-allowed ${focus}`;
export const btnSecondary =
  `inline-flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium transition disabled:opacity-55 disabled:cursor-not-allowed ${focus}`;

export const btnGhost =
  `inline-flex items-center justify-center gap-2 border border-transparent text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium transition disabled:opacity-55 disabled:cursor-not-allowed ${focus}`;
export const btnDestructive =
  "text-red-600 hover:underline text-sm disabled:opacity-55";

export const btnSplitMainPrimary = `${btnPrimary} rounded-e-none pe-3`;
export const btnSplitTriggerPrimary = `${btnPrimary} rounded-s-none border-s border-indigo-500/40 px-2.5`;

export const btnSplitMainSecondary = `${btnSecondary} rounded-e-none pe-3`;
export const btnSplitTriggerSecondary = `${btnSecondary} rounded-s-none border-s border-indigo-300 px-2.5`;
