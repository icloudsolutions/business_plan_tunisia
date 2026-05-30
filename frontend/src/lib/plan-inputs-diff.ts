/** Deep-merge `patch` into `base` (objects merged recursively; scalars/arrays replaced). */
export function mergeInputsPatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev !== null &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = mergeInputsPatch(
        prev as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Top-level (and nested object) diff for PATCH payloads — null when unchanged. */
export function diffInputsSnapshot(
  saved: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(saved), ...Object.keys(next)]);

  for (const key of keys) {
    const a = saved[key];
    const b = next[key];
    if (stableJson(a) === stableJson(b)) continue;

    if (
      b !== null &&
      typeof b === "object" &&
      !Array.isArray(b) &&
      a !== null &&
      typeof a === "object" &&
      !Array.isArray(a)
    ) {
      const nested = diffInputsSnapshot(
        a as Record<string, unknown>,
        b as Record<string, unknown>
      );
      if (nested && Object.keys(nested).length > 0) {
        patch[key] = nested;
      }
    } else {
      patch[key] = b;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function inputsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  return diffInputsSnapshot(a, b) === null;
}
