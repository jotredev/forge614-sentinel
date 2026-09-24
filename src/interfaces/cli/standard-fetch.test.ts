import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "../../infrastructure/process";

const CLI = resolve(import.meta.dir, "standard-fetch.ts");
const REPO_ROOT = resolve(import.meta.dir, "../../..");
const BASE = pathToFileURL(join(REPO_ROOT, "fixtures/standard")).href;

test("fetches the given version into FORGE614_HOME and reports it; a second call says alreadyCached", () => {
  const home = mkdtempSync(join(tmpdir(), "sentinel-fetch-cli-"));
  const env = { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: BASE };
  const first = run(["bun", "run", CLI, "1.0.0", "--json"], { cwd: REPO_ROOT, env });
  expect(first.exitCode, first.stderr).toBe(0);
  expect(JSON.parse(first.stdout.trim())).toEqual({ schemaVersion: 1, version: "1.0.0", sha256: "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922", alreadyCached: false, location: "<FORGE614_HOME>/standard/1.0.0" });
  expect(readdirSync(join(home, "standard"))).toEqual(["1.0.0"]);
  expect(JSON.parse(run(["bun", "run", CLI, "1.0.0"], { cwd: REPO_ROOT, env }).stdout.trim())).toMatchObject({ alreadyCached: true });
});

test("without a version it uses ./forge614.node.json; without either it is INVALID_ARGUMENTS", () => {
  const home = mkdtempSync(join(tmpdir(), "sentinel-fetch-cli-"));
  const env = { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: BASE };
  const fromPointer = run(["bun", "run", CLI], { cwd: join(REPO_ROOT, "fixtures/pass-node"), env });
  expect(fromPointer.exitCode, fromPointer.stderr).toBe(0);
  const none = run(["bun", "run", CLI], { cwd: join(REPO_ROOT, "fixtures/foreign-folder"), env });
  expect(none.exitCode).toBe(2);
  expect(JSON.parse(none.stderr.trim())).toMatchObject({ code: "INVALID_ARGUMENTS" });
});

test("network failure is STANDARD_FETCH_FAILED; a tampered SHA256SUMS is STANDARD_CORRUPT; both exit 1", () => {
  const home = mkdtempSync(join(tmpdir(), "sentinel-fetch-cli-"));
  const offline = run(["bun", "run", CLI, "1.0.0"], { cwd: REPO_ROOT, env: { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: BASE, FORGE614_SENTINEL_OFFLINE: "1" } });
  expect(offline.exitCode).toBe(1);
  expect(JSON.parse(offline.stderr.trim())).toMatchObject({ code: "STANDARD_FETCH_FAILED" });
  const corruptBase = pathToFileURL(join(REPO_ROOT, "fixtures/standard-corrupt")).href;
  const corrupt = run(["bun", "run", CLI, "1.0.0"], { cwd: REPO_ROOT, env: { FORGE614_HOME: home, FORGE614_SENTINEL_RELEASE_BASE: corruptBase } });
  expect(corrupt.exitCode).toBe(1);
  expect(JSON.parse(corrupt.stderr.trim())).toMatchObject({ code: "STANDARD_CORRUPT" });
  expect(readdirSync(home)).toEqual([]);
});
