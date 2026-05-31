import type { ExportFormat } from "@/lib/api";

/** Always generate all deliverables so PDF, Excel and Word stay in sync. */
export const ALL_EXPORT_FORMATS: ExportFormat[] = ["pdf", "xlsx", "docx"];
