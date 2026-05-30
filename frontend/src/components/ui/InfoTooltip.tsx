"use client";

import type { ReactNode } from "react";
import FieldHelpPopover from "@/components/ui/FieldHelpPopover";

/** Short help text in a popover (alias for field help pattern). */
export function InfoTooltip({
  text,
  label = "Aide",
}: {
  text: string;
  label?: string;
}) {
  const blocks = text.split(/\n\n+/).filter(Boolean);
  const content: ReactNode =
    blocks.length <= 1 ? (
      <p>{text}</p>
    ) : (
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <p key={i}>{block}</p>
        ))}
      </div>
    );

  return <FieldHelpPopover label={label}>{content}</FieldHelpPopover>;
}
