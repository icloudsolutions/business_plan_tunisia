import type { ExportFormat } from "@/lib/api";

/** Always generate all deliverables so PDF, Excel and Word stay in sync. */
export const ALL_EXPORT_FORMATS: ExportFormat[] = [
  "pdf",
  "xlsx",
  "docx",
  "pptx",
];

export const EXPORT_FORMAT_ORDER: ExportFormat[] = [...ALL_EXPORT_FORMATS];

export function isExportFormat(value: string): value is ExportFormat {
  return (ALL_EXPORT_FORMATS as string[]).includes(value);
}

export function exportFormatsReady(formats: string[]): ExportFormat[] {
  return EXPORT_FORMAT_ORDER.filter((f) => formats.includes(f));
}
