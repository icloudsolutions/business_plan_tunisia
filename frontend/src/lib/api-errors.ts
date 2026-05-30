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
