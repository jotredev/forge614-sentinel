import { beforeAll, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../../src/infrastructure/process";
import { CheckReportSchema, type CheckReport } from "../../src/modules/report";
import { writeFakeRelease } from "../helpers/fake-release";
import { builtBinary } from "./binary";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const FIXTURES = join(REPO_ROOT, "fixtures");
const BASE = pathToFileURL(join(FIXTURES, "standard")).href;
let bin = "";

function sentinel(args: string[], env: Record<string, string> = {}) {
  return run([bin, ...args], { cwd: REPO_ROOT, env: { FORGE614_HOME: mkdtempSync(join(tmpdir(), "sentinel-e2e-home-")), FORGE614_SENTINEL_RELEASE_BASE: BASE, ...env }, timeoutMs: 60_000 });
}

function report(stdout: string): CheckReport {
  return CheckReportSchema.parse(JSON.parse(stdout.trim()));
}

beforeAll(() => {
  bin = builtBinary();
});

describe("forge614-sentinel (compiled binary)", () => {
  test("--version and --help", () => {
    const v = sentinel(["--version"]);
    expect(v.exitCode).toBe(0);
    expect(JSON.parse(v.stdout.trim())).toMatchObject({ schemaVersion: 1, name: "forge614-sentinel" });
    expect(sentinel(["--help"]).exitCode).toBe(0);
  });

  test("pass node: verdict pass, exit 0", () => {
    const r = sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--json"]);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(report(r.stdout).verdict).toBe("pass");
  });

  test("fail node: verdict fail with exact evidence per broken check, exit 1", () => {
    const r = sentinel(["check", "--repo", join(FIXTURES, "fail-node"), "--json"]);
    expect(r.exitCode).toBe(1);
    const failed = Object.fromEntries(report(r.stdout).checks.filter((c) => c.verdict === "fail").map((c) => [c.id, c.evidence]));
    expect(Object.keys(failed).sort()).toEqual(["docs-parity", "installer", "layout", "secrets-hygiene", "stack", "versions"]);
    expect(failed["layout"]).toContain("missing file .githooks/pre-push");
    expect(failed["stack"]).toContain("src/app/bad.ts:1: any");
    expect(failed["docs-parity"]).toEqual(["docs/es/00-resumen.md: missing docs/en/00-*.md"]);
    expect(failed["versions"]).toEqual(["git tags not available (not a git checkout)", "package.json version 0.2.0 vs docs/notion-map.json productVersion 0.1.0"]);
    expect(failed["secrets-hygiene"]).toContain("src/config.ts:1: aws-access-key-id");
    expect(failed["installer"]?.[0]).toMatch(/^install\.sh:\d+: expected 'set -euo pipefail' got 'set -eu'$/);
  });

  test("external project and foreign folder: applicable false, exit 0", () => {
    expect(JSON.parse(sentinel(["check", "--repo", join(FIXTURES, "external-project"), "--json"]).stdout.trim())).toEqual({ schemaVersion: 1, applicable: false, reason: "external-project" });
    const foreign = sentinel(["check", "--repo", join(FIXTURES, "foreign-folder"), "--json"]);
    expect(foreign.exitCode).toBe(0);
    expect(JSON.parse(foreign.stdout.trim())).toEqual({ schemaVersion: 1, applicable: false, reason: "not-a-forge614-repo" });
  });

  test("no cache and no network: STANDARD_UNAVAILABLE, exit 1", () => {
    const r = sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--json"], { FORGE614_SENTINEL_OFFLINE: "1" });
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stderr.trim())).toMatchObject({ schemaVersion: 1, code: "STANDARD_UNAVAILABLE" });
  });

  test("hand-edited pointer fingerprint: STANDARD_CORRUPT before any check, exit 1, no report", () => {
    const root = mkdtempSync(join(tmpdir(), "sentinel-e2e-handptr-"));
    cpSync(join(FIXTURES, "pass-node"), root, { recursive: true });
    const pointerPath = join(root, "forge614.node.json");
    writeFileSync(pointerPath, readFileSync(pointerPath, "utf8").replace("18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922", "0".repeat(64)));
    const r = sentinel(["check", "--repo", root, "--json"]);
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe("");
    expect(JSON.parse(r.stderr.trim())).toMatchObject({ schemaVersion: 1, code: "STANDARD_CORRUPT" });
  });

  test("tampered release fingerprint: STANDARD_CORRUPT, exit 1, nothing cached", () => {
    const home = mkdtempSync(join(tmpdir(), "sentinel-e2e-corrupt-"));
    const r = sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--json"], { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: pathToFileURL(join(FIXTURES, "standard-corrupt")).href });
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.stderr.trim())).toMatchObject({ code: "STANDARD_CORRUPT" });
  });

  test("--only, --strict and --standard forced", () => {
    const only = sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--only", "layout,stack", "--json"]);
    expect(report(only.stdout).checks.map((c) => c.id)).toEqual(["layout", "stack"]);
    const release = writeFakeRelease("1.0.1", (m) => m);
    const home = mkdtempSync(join(tmpdir(), "sentinel-e2e-forced-"));
    const forced = sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--standard", "1.0.1", "--json"], { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: release.base });
    expect(forced.exitCode, forced.stderr).toBe(0);
    const fr = report(forced.stdout);
    expect(fr.standard).toEqual({ version: "1.0.1", sha256: release.sha256, forced: true, fetched: true });
    expect(fr.verdict).toBe("caution"); // node-pointer cannot cross-check: 1.0.0 is not cached in this home
    expect(fr.checks.find((c) => c.id === "installer")?.verdict).toBe("pass"); // STANDARD_VERSION comes from the pointer
    expect(sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--standard", "1.0.1", "--strict", "--json"], { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: release.base }).exitCode).toBe(1);
  });

  test("latestKnown appears when a newer standard is cached than the one the node declares", () => {
    const release = writeFakeRelease("1.0.1", (m) => m);
    const home = mkdtempSync(join(tmpdir(), "sentinel-e2e-latest-"));
    sentinel(["standard", "fetch", "1.0.1"], { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: release.base });
    const r = sentinel(["check", "--repo", join(FIXTURES, "pass-node"), "--json"], { FORGE614_HOME: home });
    expect(report(r.stdout).standard).toMatchObject({ version: "1.0.0", latestKnown: "1.0.1" });
  });

  test("without --json on a non-TTY stderr only the JSON is printed", () => {
    const r = sentinel(["check", "--repo", join(FIXTURES, "pass-node")]);
    expect(r.stderr).toBe("");
    expect(r.stdout.trim().split("\n")).toHaveLength(1);
  });

  test("the golden reports match this platform's output (what the parity job compares)", () => {
    for (const name of ["pass-node", "fail-node"]) {
      const r = sentinel(["check", "--repo", join(FIXTURES, name), "--json"]);
      const { durationMs: _ignored, ...rest } = report(r.stdout);
      expect(`${JSON.stringify(rest, null, 2)}\n`).toBe(readFileSync(join(FIXTURES, "golden", `${name}.report.json`), "utf8"));
    }
  });
});
