/** Application roles from JWT / `GET /me`. */
export type AppRole = "client" | "expert" | "admin";

export function userHasRole(
  role: string | undefined | null,
  allowed: readonly AppRole[]
): boolean {
  return !!role && (allowed as readonly string[]).includes(role);
}
