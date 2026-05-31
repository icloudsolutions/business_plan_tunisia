"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  btnSplitMainPrimary,
  btnSplitMainSecondary,
  btnSplitTriggerPrimary,
  btnSplitTriggerSecondary,
} from "@/components/plan/plan-action-styles";

type Props = {
  variant?: "primary" | "secondary";
  label: string;
  pdfLabel: string;
  xlsxLabel: string;
  docxLabel: string;
  regenerateLabel: string;
  busy?: boolean;
  canPdf: boolean;
  canXlsx: boolean;
  canDocx: boolean;
  onGenerate: () => void;
  onDownloadPdf: () => void;
  onDownloadXlsx: () => void;
  onDownloadDocx: () => void;
};

export default function ExportSplitButton({
  variant = "primary",
  label,
  pdfLabel,
  xlsxLabel,
  docxLabel,
  regenerateLabel,
  busy,
  canPdf,
  canXlsx,
  canDocx,
  onGenerate,
  onDownloadPdf,
  onDownloadXlsx,
  onDownloadDocx,
}: Props) {
  const mainClass =
    variant === "secondary" ? btnSplitMainSecondary : btnSplitMainPrimary;
  const triggerClass =
    variant === "secondary" ? btnSplitTriggerSecondary : btnSplitTriggerPrimary;

  const handleMain = () => {
    if (busy) return;
    if (canDocx) onDownloadDocx();
    else if (canPdf) onDownloadPdf();
    else if (canXlsx) onDownloadXlsx();
    else onGenerate();
  };

  return (
    <div className="inline-flex">
      <button
        type="button"
        className={mainClass}
        disabled={busy}
        onClick={handleMain}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {label}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={triggerClass}
            disabled={busy}
            aria-label={label}
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[11rem] rounded-lg border border-navy-100 bg-white p-1 shadow-lg"
            sideOffset={4}
            align="end"
          >
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-800 outline-none hover:bg-indigo-50 focus:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onSelect={onDownloadPdf}
              disabled={!canPdf}
            >
              <FileText className="h-4 w-4 text-indigo-600" aria-hidden />
              {pdfLabel}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-800 outline-none hover:bg-indigo-50 focus:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onSelect={onDownloadXlsx}
              disabled={!canXlsx}
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" aria-hidden />
              {xlsxLabel}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-800 outline-none hover:bg-indigo-50 focus:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              onSelect={onDownloadDocx}
              disabled={!canDocx}
            >
              <FileType className="h-4 w-4 text-indigo-600" aria-hidden />
              {docxLabel}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-navy-100" />
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-800 outline-none hover:bg-indigo-50 focus:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
              onSelect={onGenerate}
            >
              <RefreshCw className="h-4 w-4 text-indigo-600" aria-hidden />
              {regenerateLabel}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
