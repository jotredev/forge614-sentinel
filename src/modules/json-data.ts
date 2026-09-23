// A data file that is not valid JSON must surface as evidence naming the
// path, never as an exception out of a check (acta 0013).
export type JsonData = { ok: true; data: unknown } | { ok: false; evidence: string };

export function parseJsonData(path: string, raw: string): JsonData {
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, evidence: `${path}: invalid JSON: ${message}` };
  }
}
