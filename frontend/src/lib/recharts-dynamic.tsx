"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type ChartComponent = ComponentType<Record<string, unknown>>;

/** Recharts exports are class components with props that do not match next/dynamic inference. */
const toChart = (C: unknown): ChartComponent => C as ChartComponent;

export const Area = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Area) })),
  { ssr: false }
);
export const Bar = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Bar) })),
  { ssr: false }
);
export const BarChart = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.BarChart) })),
  { ssr: false }
);
export const CartesianGrid = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.CartesianGrid) })),
  { ssr: false }
);
export const Cell = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Cell) })),
  { ssr: false }
);
export const ComposedChart = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.ComposedChart) })),
  { ssr: false }
);
export const Legend = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Legend) })),
  { ssr: false }
);
export const Line = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Line) })),
  { ssr: false }
);
export const LineChart = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.LineChart) })),
  { ssr: false }
);
export const Pie = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Pie) })),
  { ssr: false }
);
export const PieChart = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.PieChart) })),
  { ssr: false }
);
export const ReferenceLine = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.ReferenceLine) })),
  { ssr: false }
);
export const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.ResponsiveContainer) })),
  { ssr: false }
);
export const Tooltip = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.Tooltip) })),
  { ssr: false }
);
export const XAxis = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.XAxis) })),
  { ssr: false }
);
export const YAxis = dynamic(
  () => import("recharts").then((m) => ({ default: toChart(m.YAxis) })),
  { ssr: false }
);
