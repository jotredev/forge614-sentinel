import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../../src/infrastructure/process";
import { CheckReportSchema } from "../../src/modules/report";
import { builtBinary } from "./binary";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const BUDGET_MS = 5000;
let bin = "";

beforeAll(() => {
  bin = builtBinary();
});

// spec §11: an ecosystem node in under 5 s. Sentinel's own repository (the
// largest tree at hand, with git facts) is the measured case; the fixture
// warms the cache first so the run measures checking, not downloading.
test(`checks this repository in under ${BUDGET_MS} ms (wall clock and durationMs)`, () => {
  const env = { FORGE614_HOME: mkdtempSync(join(tmpdir(), "sentinel-budget-")), FORGE614_SENTINEL_RELEASE_BASE: pathToFileURL(join(REPO_ROOT, "fixtures/standard")).href };
  run([bin, "standard", "fetch", "1.0.0"], { cwd: REPO_ROOT, env });
  const started = performance.now();
  const r = run([bin, "check", "--repo", REPO_ROOT, "--json"], { cwd: REPO_ROOT, env, timeoutMs: 30_000 });
  const wall = performance.now() - started;
  const report = CheckReportSchema.parse(JSON.parse(r.stdout.trim()));
  expect(report.durationMs).toBeLessThan(BUDGET_MS);
  expect(wall).toBeLessThan(BUDGET_MS);
});
