"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  minWidth?: number | string;
  /** Max height with vertical scroll (tables with many rows). */
  maxHeight?: string;
};

/**
 * Edge-to-edge horizontal scroll on mobile; keeps wide tables usable.
 */
export default function ResponsiveScroll({
  children,
  className = "",
  minWidth,
  maxHeight,
}: Props) {
  return (
    <div
      className={[
        "-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0",
        maxHeight ? `overflow-y-auto ${maxHeight}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={minWidth ? { WebkitOverflowScrolling: "touch" } : undefined}
    >
      <div style={minWidth ? { minWidth } : undefined} className="inline-block min-w-full">
        {children}
      </div>
    </div>
  );
}
