import { worst } from "../modules/check";
import { compareSemver } from "../modules/semver";
import type { CheckEntry, CheckReport } from "../modules/report";

export interface BuildReportInput {
  sentinelVersion: string;
  standard: { version: string; sha256: string; forced: boolean; fetched: boolean; latestKnown: string };
  repositoryName: string;
  entries: CheckEntry[];
  durationMs: number;
}

export function buildReport(input: BuildReportInput): CheckReport {
  const { version, sha256, forced, fetched, latestKnown } = input.standard;
  const newer = compareSemver(latestKnown, version) > 0;
  return {
    schemaVersion: 1,
    sentinel: input.sentinelVersion,
    standard: { version, sha256, forced, fetched, ...(newer ? { latestKnown } : {}) },
    repository: { kind: "node", name: input.repositoryName },
    verdict: worst(input.entries.filter((e) => e.applied).map((e) => e.verdict)),
    checks: input.entries,
    durationMs: input.durationMs,
  };
}
