import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFakeRelease } from "../../../tests/helpers/fake-release";
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

test("--standard with a newer standard that requests an unknown validator: caution exits 0, --strict exits 1, report is marked forced", () => {
  // A fake 1.0.1 release built from the 1.0.0 fixture (tests/helpers/fake-release.ts)
  // whose thin-workflows manifest asks for a validator Sentinel does not have.
  const release = writeFakeRelease("1.0.1", (members) =>
    members.map((m) => (m.path === "rules/forge614-rule-thin-workflows/manifest.json" ? { ...m, content: new TextEncoder().encode(new TextDecoder().decode(m.content).replace('"validator": "workflows"', '"validator": "boundaries-zod"')) } : m)),
  );
  const home = mkdtempSync(join(tmpdir(), "sentinel-cli-strict-"));
  const soft = cli(["--repo", join(FIXTURES, "pass-node"), "--standard", "1.0.1", "--json"], { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: release.base });
  expect(soft.exitCode, soft.stderr).toBe(0);
  const report = CheckReportSchema.parse(JSON.parse(soft.stdout.trim()));
  expect(report.verdict).toBe("caution");
  expect(report.standard).toMatchObject({ version: "1.0.1", sha256: release.sha256, forced: true });
  expect(report.checks.find((c) => c.id === "node-pointer")?.verdict).toBe("caution");
  // installer renders STANDARD_VERSION from the pointer (1.0.0), not from the forced 1.0.1.
  expect(report.checks.find((c) => c.id === "installer")?.verdict).toBe("pass");
  expect(report.checks.find((c) => c.id === "boundaries-zod")?.evidence[0]).toStartWith("SENTINEL_OUTDATED:");
  const strict = cli(["--repo", join(FIXTURES, "pass-node"), "--standard", "1.0.1", "--strict", "--json"], { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: release.base });
  expect(strict.exitCode).toBe(1);
});
