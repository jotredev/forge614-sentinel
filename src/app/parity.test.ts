import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CheckReport } from "../modules/report";
import { canonicalJson, normalizeReport, runParity } from "./parity";
import { repoRoot } from "./repo";

const PACKAGE_VERSION: string = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
const options = { update: false, sentinelVersion: PACKAGE_VERSION, today: "2026-09-23" };

// Needs the goldens of step 5; until they exist this test fails, which is
// the expected red of this step.
test("the committed goldens match this platform's reports", async () => {
  expect(await runParity({ ...options, root: repoRoot })).toEqual({ ok: true, compared: ["pass-node", "fail-node"] });
});

test("normalizeReport drops durationMs only; canonicalJson is two-space JSON with a final newline", () => {
  const report: CheckReport = {
    schemaVersion: 1,
    sentinel: "0.1.0",
    standard: { version: "1.0.0", sha256: "0".repeat(64), forced: false, fetched: true },
    repository: { kind: "node", name: "demo" },
    verdict: "pass",
    checks: [],
    durationMs: 42,
  };
  const { durationMs: _dropped, ...rest } = report;
  expect(normalizeReport(report)).toEqual(rest);
  expect(canonicalJson({ a: 1 })).toBe('{\n  "a": 1\n}\n');
});

test("a golden changed by one word in a temporary copy is PARITY_MISMATCH naming the line", async () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-parity-copy-"));
  cpSync(join(repoRoot, "fixtures"), join(root, "fixtures"), { recursive: true });
  const golden = join(root, "fixtures/golden/pass-node.report.json");
  // The first "verdict" in the file is the report's own (it precedes checks).
  writeFileSync(golden, readFileSync(golden, "utf8").replace('"verdict": "pass"', '"verdict": "fail"'));
  const r = await runParity({ ...options, root });
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.code).toBe("PARITY_MISMATCH");
  expect(r.diffs).toHaveLength(1);
  expect(r.diffs[0]).toMatch(/^pass-node: line \d+: golden '\s*"verdict": "fail",' vs actual '\s*"verdict": "pass",'$/);
});
