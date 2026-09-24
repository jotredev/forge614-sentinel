function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepDiff(expected: unknown, actual: unknown, path: string): string[] {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return [`${path}: ${actual.length} items vs template ${expected.length}`];
    return expected.flatMap((e, i) => deepDiff(e, actual[i], `${path}[${i}]`));
  }
  if (isRecord(expected) && isRecord(actual)) {
    const out: string[] = [];
    for (const key of Object.keys(expected)) {
      if (!(key in actual)) out.push(`${path}.${key}: missing`);
      else out.push(...deepDiff(expected[key], actual[key], `${path}.${key}`));
    }
    for (const key of Object.keys(actual)) if (!(key in expected)) out.push(`${path}.${key}: unexpected`);
    return out;
  }
  return JSON.stringify(expected) === JSON.stringify(actual) ? [] : [`${path}: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`];
}
