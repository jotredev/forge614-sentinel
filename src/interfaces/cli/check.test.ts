import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../../infrastructure/process";
import { CheckReportSchema } from "../../modules/report";

const CLI = resolve(import.meta.dir, "check.ts");
const REPO_ROOT = resolve(import.meta.dir, "../../..");
const FIXTURES = join(REPO_ROOT, "fixtures");
const env = () => ({ FORGE614_HOME: mkdtempSync(join(tmpdir(), "sentinel-cli-")), FORGE614_SENTINEL_RELEASE_BASE: pathToFileURL(join(FIXTURES, "standard")).href });

function cli(args: string[], extraEnv: Record<string, string> = {}) {
  return run(["bun", "run", CLI, ...args], { cwd: REPO_ROOT, env: { ...env(), ...extraEnv } });
}

test("--help prints usage with the error codes and exits 0", () => {
  const r = cli(["--help"]);
  expect(r.exitCode).toBe(0);
  expect(JSON.parse(r.stdout.trim())).toMatchObject({ schemaVersion: 1, usage: "check [--repo <path>] [--standard <version>] [--only <id,id>] [--strict] [--json]" });
});

test("unknown flag, positional, bad --standard and unknown --only id are INVALID_ARGUMENTS with exit 2", () => {
  for (const args of [["--repo", ".", "--jsn"], ["extra"], ["--standard", "v1"], ["--only", "layout,nope"]]) {
    const r = cli(args);
    expect(r.exitCode, args.join(" ")).toBe(2);
    expect(JSON.parse(r.stderr.trim())).toMatchObject({ schemaVersion: 1, code: "INVALID_ARGUMENTS" });
    expect(r.stdout).toBe("");
  }
});

test("pass-node with --json: a single CheckReport on stdout, nothing on stderr, exit 0", () => {
  const r = cli(["--repo", join(FIXTURES, "pass-node"), "--json"]);
  expect(r.exitCode, r.stderr).toBe(0);
  expect(r.stderr).toBe("");
  const report = CheckReportSchema.parse(JSON.parse(r.stdout.trim()));
  expect(report.verdict).toBe("pass");
  expect(r.stdout.trim().split("\n")).toHaveLength(1);
});

test("fail-node exits 1 and still prints the full report; --only narrows", () => {
  const fail = cli(["--repo", join(FIXTURES, "fail-node"), "--json"]);
  expect(fail.exitCode).toBe(1);
  expect(CheckReportSchema.parse(JSON.parse(fail.stdout.trim())).verdict).toBe("fail");
  const only = cli(["--repo", join(FIXTURES, "fail-node"), "--only", "docs-parity", "--json"]);
  expect(JSON.parse(only.stdout.trim()).checks.map((c: { id: string }) => c.id)).toEqual(["docs-parity"]);
});

test("external project and foreign folder print the not-applicable report and exit 0", () => {
  const ext = cli(["--repo", join(FIXTURES, "external-project"), "--json"]);
  expect(ext.exitCode).toBe(0);
  expect(JSON.parse(ext.stdout.trim())).toEqual({ schemaVersion: 1, applicable: false, reason: "external-project" });
  const foreign = cli(["--repo", join(FIXTURES, "foreign-folder"), "--json"]);
  expect(JSON.parse(foreign.stdout.trim())).toEqual({ schemaVersion: 1, applicable: false, reason: "not-a-forge614-repo" });
});

test("no cache and no network: STANDARD_UNAVAILABLE on stderr with the fetch command, exit 1, no stdout", () => {
  const r = cli(["--repo", join(FIXTURES, "pass-node"), "--json"], { FORGE614_SENTINEL_OFFLINE: "1" });
  expect(r.exitCode).toBe(1);
  expect(r.stdout).toBe("");
  const envelope = JSON.parse(r.stderr.trim());
  expect(envelope).toMatchObject({ schemaVersion: 1, code: "STANDARD_UNAVAILABLE" });
  expect(envelope.error).toContain("forge614-sentinel standard fetch 1.0.0");
  expect(envelope.error).not.toContain(tmpdir());
});

test("an invalid pointer is NODE_POINTER_INVALID with exit 2", async () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-cli-ptr-"));
  await Bun.write(join(root, "forge614.node.json"), "{}");
  const r = cli(["--repo", root, "--json"]);
  expect(r.exitCode).toBe(2);
  expect(JSON.parse(r.stderr.trim())).toMatchObject({ code: "NODE_POINTER_INVALID" });
});

test("a crashing check prints the report (verdict fail) on stdout AND a CHECK_FAILED envelope on stderr, exit 1", () => {
  const r = cli(["--repo", join(FIXTURES, "pass-node"), "--json"], { FORGE614_SENTINEL_CRASH_CHECK: "layout" });
  expect(r.exitCode).toBe(1);
  const report = CheckReportSchema.parse(JSON.parse(r.stdout.trim()));
  expect(report.verdict).toBe("fail");
  expect(report.checks.find((c) => c.id === "layout")?.evidence).toEqual(["CHECK_FAILED: injected crash"]);
  expect(JSON.parse(r.stderr.trim())).toMatchObject({ schemaVersion: 1, code: "CHECK_FAILED" });
});
