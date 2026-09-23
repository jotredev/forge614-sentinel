export const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(value: string): [number, number, number] | null {
  const m = SEMVER_PATTERN.exec(value);
  if (m === null) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Returns a negative number when a < b, zero when equal, positive when a > b.
// Non-semver input sorts before any valid version so callers can still order.
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa === null || pb === null) return pa === null && pb === null ? 0 : pa === null ? -1 : 1;
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function highestSemver(values: readonly string[]): string | undefined {
  return [...values].filter((v) => SEMVER_PATTERN.test(v)).sort(compareSemver).at(-1);
}
