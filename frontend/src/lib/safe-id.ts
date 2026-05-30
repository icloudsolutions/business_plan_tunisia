/** ID stable sans dépendre à crypto.randomUUID (requiert HTTPS / localhost). */
export function createSafeId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    try {
      return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
    } catch {
      /* insecure context */
    }
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
