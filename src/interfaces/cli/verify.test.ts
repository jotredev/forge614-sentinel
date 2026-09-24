import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { run } from "../../infrastructure/process";

const CLI = resolve(import.meta.dir, "verify.ts");
const REPO_ROOT = resolve(import.meta.dir, "../../..");

test("--help and an unknown flag", () => {
  expect(JSON.parse(run(["bun", "run", CLI, "--help"], { cwd: REPO_ROOT }).stdout.trim())).toMatchObject({ schemaVersion: 1, usage: "verify [--skip-tests]" });
  const r = run(["bun", "run", CLI, "--nope"], { cwd: REPO_ROOT });
  expect(r.exitCode).toBe(2);
});

// The full run (typecheck + tests + self-check) is what CI and the pre-push
// hook execute; here only the cheap path is exercised so the test suite does
// not recurse into itself. This assertion holds while CONTRACT.md is still
// the empty template; the test that also demands exit 0 and verdict pass
// arrives together with the filled-in contract.
test("--skip-tests runs typecheck, workflows:check and notion-map:build --check green, then sentinel:check", () => {
  const r = run(["bun", "run", CLI, "--skip-tests"], { cwd: REPO_ROOT, timeoutMs: 300_000 });
  for (const label of ["typecheck", "workflows:check", "notion-map:build --check"]) expect(r.stderr).toContain(`[verify] ${label}: exit 0`);
  expect(r.stderr).toContain("[verify] sentinel:check: exit ");
});

test("--skip-tests exits 0 with one JSON: every step green and the self-check verdict pass", () => {
  const r = run(["bun", "run", CLI, "--skip-tests"], { cwd: REPO_ROOT, timeoutMs: 300_000 });
  expect(r.exitCode, r.stderr).toBe(0);
  const out = JSON.parse(r.stdout.trim());
  expect(out).toMatchObject({ schemaVersion: 1, ok: true });
  expect(out.steps.map((s: { label: string }) => s.label)).toEqual(["typecheck", "workflows:check", "notion-map:build --check", "sentinel:check"]);
  expect(out.sentinel.verdict).toBe("pass");
});
