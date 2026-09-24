import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileFetcher } from "../infrastructure/network";
import { writeTextAtomic } from "../infrastructure/fs-write";
import type { CheckReport } from "../modules/report";
import { checkRepository, type CheckRepositoryResult } from "./check-repository";

const CASES = ["pass-node", "fail-node"] as const;

export function normalizeReport(report: CheckReport): Omit<CheckReport, "durationMs"> {
  const { durationMs: _dropped, ...rest } = report;
  return rest;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export type ParityResult = { ok: true; compared: string[] } | { ok: false; code: "PARITY_MISMATCH"; error: string; diffs: string[] };

// The same fixture must yield the same report (minus durationMs) on ubuntu,
// macOS and Windows (spec §12). The golden files are the report generated on
// one platform and committed; every platform compares against them.
// `--update` rewrites them (a reviewed change of behavior, never CI).
export async function runParity(options: { root: string; update: boolean; sentinelVersion: string; today: string }): Promise<ParityResult> {
  const diffs: string[] = [];
  const compared: string[] = [];
  for (const name of CASES) {
    // A fresh cache per fixture, created and removed here: every golden then
    // records `fetched: true`, which is what the e2e test sees when the
    // binary runs each case with an empty FORGE614_HOME. A cache shared
    // across cases would turn the second report into `fetched: false`.
    const cacheRoot = mkdtempSync(join(tmpdir(), `sentinel-parity-${name}-`));
    let result: CheckRepositoryResult;
    try {
      result = await checkRepository({
        root: resolve(options.root, "fixtures", name),
        cacheRoot,
        fetcher: fileFetcher(),
        releaseBase: pathToFileURL(resolve(options.root, "fixtures/standard")).href,
        today: options.today,
        sentinelVersion: options.sentinelVersion,
      });
    } finally {
      rmSync(cacheRoot, { recursive: true, force: true });
    }
    if (result.kind !== "report") return { ok: false, code: "PARITY_MISMATCH", error: `fixtures/${name} did not produce a report (${result.kind})`, diffs: [] };
    const actual = canonicalJson(normalizeReport(result.report));
    const goldenPath = join(options.root, "fixtures/golden", `${name}.report.json`);
    if (options.update) {
      writeTextAtomic(goldenPath, actual);
      compared.push(`${name} (updated)`);
      continue;
    }
    const expected = readFileSync(goldenPath, "utf8");
    if (expected !== actual) {
      const e = expected.split("\n");
      const a = actual.split("\n");
      const first = e.findIndex((line, i) => line !== a[i]);
      diffs.push(`${name}: line ${first + 1}: golden '${e[first] ?? ""}' vs actual '${a[first] ?? ""}'`);
    }
    compared.push(name);
  }
  return diffs.length === 0 ? { ok: true, compared } : { ok: false, code: "PARITY_MISMATCH", error: `report differs from golden on ${diffs.length} fixture(s)`, diffs };
}
