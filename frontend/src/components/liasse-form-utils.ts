export type Inputs = Record<string, unknown>;

export function get(obj: Inputs, path: string, fallback: string | number = ""): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return String(fallback);
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur != null ? String(cur) : String(fallback);
}

export function set(obj: Inputs, path: string, value: string | number): Inputs {
  const parts = path.split(".");
  const out = JSON.parse(JSON.stringify(obj)) as Inputs;
  let cur: Record<string, unknown> = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  const num = parseFloat(String(value));
  cur[last] = isNaN(num) || String(value).trim() === "" ? value : num;
  return out;
}

export function getArray<T extends Record<string, unknown>>(
  obj: Inputs,
  path: string
): T[] {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return [];
    cur = (cur as Record<string, unknown>)[p];
  }
  return Array.isArray(cur) ? (cur as T[]) : [];
}

export function setArray(obj: Inputs, path: string, arr: unknown[]): Inputs {
  const parts = path.split(".");
  const out = JSON.parse(JSON.stringify(obj)) as Inputs;
  let cur: Record<string, unknown> = out;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = arr;
  return out;
}

export const DEFAULT_EQUIPMENT = {
  name: "Nouvel équipement",
  cost: 0,
  usefulLifeYears: 5,
  acquisitionYear: 1,
  assetType: "tangible",
};
