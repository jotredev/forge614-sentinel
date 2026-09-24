import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildCheckParams } from "../src/app/build-check-params";
import { classifyRepository } from "../src/app/classify-repository";
import { fetchStandard } from "../src/app/fetch-standard";
import { loadStandard, type LoadedStandard } from "../src/app/load-standard";
import { takeSnapshot } from "../src/app/take-snapshot";
import { fileFetcher } from "../src/infrastructure/network";
import { CHECKS } from "../src/modules/checks";
import { standardSource } from "../src/modules/standard-source";
import { FIXTURES } from "./helpers/snapshot-from-dir";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
let standard: LoadedStandard | undefined;

beforeAll(async () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), "sentinel-full-node-"));
  const fetched = await fetchStandard({ source: standardSource("1.0.0", SHA), cacheRoot, fetcher: fileFetcher(), releaseBase: pathToFileURL(join(FIXTURES, "standard")).href });
  if (!fetched.ok) throw new Error(fetched.error);
  const loaded = loadStandard({ version: "1.0.0", expectedSha256: SHA, cacheRoot });
  if (!loaded.ok) throw new Error(loaded.error);
  standard = loaded.standard;
});

// id → verdict for every registered check, "not-applicable" when its
// appliesWhen is false.
function verdicts(name: string): Record<string, string> {
  if (standard === undefined) throw new Error("standard not loaded");
  const root = join(FIXTURES, name);
  const classification = classifyRepository(root);
  if (classification.kind !== "node") throw new Error(`${name}: ${classification.kind}`);
  const built = buildCheckParams({ standard, pointer: classification.pointer, pointerVersionSha256: SHA, today: "2026-09-23", sentinelVersion: "0.1.0", knownCheckIds: CHECKS.map((c) => c.id) });
  if (!built.ok) throw new Error(built.error);
  const snapshot = takeSnapshot(root);
  const out: Record<string, string> = {};
  for (const check of CHECKS) out[check.id] = check.appliesWhen(snapshot, built.params) ? check.run(snapshot, built.params).verdict : "not-applicable";
  return out;
}

test("pass-node passes every applicable check; support-matrix, context-budget and rules-catalog do not apply", () => {
  const notPass = Object.entries(verdicts("pass-node")).filter(([, verdict]) => verdict !== "pass").sort();
  expect(notPass).toEqual([
    ["context-budget", "not-applicable"],
    ["rules-catalog", "not-applicable"],
    ["support-matrix", "not-applicable"],
  ]);
});

test("fail-node fails exactly the six broken checks", () => {
  const failed = Object.entries(verdicts("fail-node")).filter(([, verdict]) => verdict === "fail").map(([id]) => id).sort();
  expect(failed).toEqual(["docs-parity", "installer", "layout", "secrets-hygiene", "stack", "versions"]);
});

test("external-project and foreign-folder are classified by identity files only", () => {
  expect(classifyRepository(join(FIXTURES, "external-project"))).toEqual({ kind: "external-project" });
  expect(classifyRepository(join(FIXTURES, "foreign-folder"))).toEqual({ kind: "not-a-forge614-repo" });
});
