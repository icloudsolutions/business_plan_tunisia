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

/** Parse FastAPI 422 `{ detail: { missingFields: string[] } }` from ApiHttpError message. */
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
