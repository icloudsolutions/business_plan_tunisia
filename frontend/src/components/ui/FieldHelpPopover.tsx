"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FOCUS_RING } from "@/lib/a11y";
import { cn } from "@/lib/utils";

type Props = {
  /** Accessible name for the trigger (usually the field label). */
  label: string;
  children: React.ReactNode;
};

export default function FieldHelpPopover({ label, children }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "ms-1.5 inline-flex shrink-0 rounded-full text-gray-600 transition-colors hover:text-indigo-600",
            FOCUS_RING
          )}
          aria-label={`Aide : ${label}`}
        >
          <InformationCircleIcon className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}
