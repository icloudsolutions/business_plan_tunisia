import type { AuditResult } from "./api";

export class ApiHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

export function isApiHttpError(e: unknown, status?: number): e is ApiHttpError {
  return (
    e instanceof ApiHttpError && (status === undefined || e.status === status)
  );
}

function extractAuditPayload(parsed: unknown): AuditResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const detail = (root.detail ?? root) as Record<string, unknown>;
  const audit = detail.audit ?? root.audit;
  if (audit && typeof audit === "object") {
    return audit as AuditResult;
  }
  return null;
}

/** Parse FastAPI 400 `{ detail: { audit: AuditResult } }` from transition/validate failures. */
export function parseAuditFromApiError(e: unknown): AuditResult | null {
  if (!isApiHttpError(e, 400)) return null;
  try {
    return extractAuditPayload(JSON.parse(e.message));
  } catch {
    /* not JSON */
  }
  return null;
}

/** Short French summary for blocked approval (audit panel shows full detail). */
export function formatApproveBlockedMessage(audit: AuditResult): string {
  const lines = audit.recommendations?.length
    ? audit.recommendations
    : [];
  if (audit.decision === "REJECT") {
    return [
      "Approbation impossible : données bloquantes.",
      ...lines,
    ].join(" ");
  }
  return [
    "Approbation bloquée par l'audit financier.",
    ...lines,
  ].join(" ");
}

export function parseMissingFieldsFromApiError(e: unknown): string[] {
  if (!isApiHttpError(e, 422)) return [];
  try {
    const outer = JSON.parse(e.message) as { detail?: unknown };
    const detail = outer.detail ?? outer;
    if (
      detail &&
      typeof detail === "object" &&
      "missingFields" in detail &&
      Array.isArray((detail as { missingFields: unknown }).missingFields)
    ) {
      return (detail as { missingFields: string[] }).missingFields;
    }
  } catch {
    /* not JSON */
  }
  return [];
}
