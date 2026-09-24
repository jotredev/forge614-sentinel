import { expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileFetcher, offlineFetcher } from "../infrastructure/network";
import { CheckReportSchema } from "../modules/report";
import { checkRepository } from "./check-repository";

const FIXTURES = resolve(import.meta.dir, "../../fixtures");
const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
const BASE = pathToFileURL(join(FIXTURES, "standard")).href;
const base = () => ({ cacheRoot: mkdtempSync(join(tmpdir(), "sentinel-check-")), fetcher: fileFetcher(), releaseBase: BASE, today: "2026-09-23", sentinelVersion: "0.1.0" });

test("pass-node: verdict pass, 19 entries, three not-applicable, standard fetched on first run and cached on the second", async () => {
  const options = { ...base(), root: join(FIXTURES, "pass-node") };
  const first = await checkRepository(options);
  expect(first.kind).toBe("report");
  if (first.kind !== "report") return;
  expect(CheckReportSchema.safeParse(first.report).success).toBe(true);
  expect(first.report.verdict).toBe("pass");
  expect(first.report.checks).toHaveLength(19);
  expect(first.report.checks.filter((c) => c.verdict === "not-applicable").map((c) => c.id)).toEqual(["support-matrix", "context-budget", "rules-catalog"]);
  expect(first.report.standard).toEqual({ version: "1.0.0", sha256: "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922", forced: false, fetched: true });
  expect(first.report.repository).toEqual({ kind: "node", name: "demo" });
  const second = await checkRepository(options);
  if (second.kind !== "report") throw new Error(second.kind);
  expect(second.report.standard.fetched).toBe(false);
});

test("fail-node: verdict fail with exactly the six broken checks failing", async () => {
  const r = await checkRepository({ ...base(), root: join(FIXTURES, "fail-node") });
  if (r.kind !== "report") throw new Error(r.kind);
  expect(r.report.verdict).toBe("fail");
  expect(r.report.checks.filter((c) => c.verdict === "fail").map((c) => c.id).sort()).toEqual(["docs-parity", "installer", "layout", "secrets-hygiene", "stack", "versions"]);
  expect(r.crashed).toEqual([]);
});

test("a hand-edited pointer fingerprint is STANDARD_CORRUPT before any check runs (fresh cache and warm cache)", async () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-handptr-"));
  cpSync(join(FIXTURES, "pass-node"), root, { recursive: true });
  const pointerPath = join(root, "forge614.node.json");
  writeFileSync(pointerPath, readFileSync(pointerPath, "utf8").replace(SHA, "0".repeat(64)));
  // Fresh cache: SHA256SUMS of the release disagrees with the pointer.
  expect(await checkRepository({ ...base(), root })).toMatchObject({ kind: "error", code: "STANDARD_CORRUPT" });
  // Warm cache: the cached manifest disagrees with the pointer.
  const options = base();
  expect((await checkRepository({ ...options, root: join(FIXTURES, "pass-node") })).kind).toBe("report");
  expect(await checkRepository({ ...options, root })).toMatchObject({ kind: "error", code: "STANDARD_CORRUPT" });
});

test("external project and foreign folder are not applicable, without loading the standard", async () => {
  let calls = 0;
  const fetcher = async (url: string) => {
    calls += 1;
    return fileFetcher()(url);
  };
  expect(await checkRepository({ ...base(), fetcher, root: join(FIXTURES, "external-project") })).toEqual({ kind: "not-applicable", report: { schemaVersion: 1, applicable: false, reason: "external-project" } });
  expect(await checkRepository({ ...base(), fetcher, root: join(FIXTURES, "foreign-folder") })).toEqual({ kind: "not-applicable", report: { schemaVersion: 1, applicable: false, reason: "not-a-forge614-repo" } });
  expect(calls).toBe(0);
});

test("no cache and no network is STANDARD_UNAVAILABLE naming the fetch command; nothing is checked", async () => {
  const r = await checkRepository({ ...base(), fetcher: offlineFetcher(), root: join(FIXTURES, "pass-node") });
  expect(r).toMatchObject({ kind: "error", code: "STANDARD_UNAVAILABLE" });
  if (r.kind !== "error") return;
  expect(r.error).toContain("forge614-sentinel standard fetch 1.0.0");
});

test("--only runs the named checks only; --standard forces a version and marks the report", async () => {
  const options = { ...base(), root: join(FIXTURES, "pass-node") };
  const only = await checkRepository({ ...options, only: ["layout", "versions"] });
  if (only.kind !== "report") throw new Error(only.kind);
  expect(only.report.checks.map((c) => c.id)).toEqual(["layout", "versions"]);
  const forced = await checkRepository({ ...options, standardVersion: "1.0.0" });
  if (forced.kind !== "report") throw new Error(forced.kind);
  expect(forced.report.standard.forced).toBe(true);
  expect(forced.report.checks.find((c) => c.id === "node-pointer")?.verdict).toBe("pass");
  const unknown = await checkRepository({ ...options, standardVersion: "9.9.9" });
  expect(unknown).toMatchObject({ kind: "error", code: "STANDARD_FETCH_FAILED" });
});

test("an invalid pointer is NODE_POINTER_INVALID", async () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-badptr-"));
  await Bun.write(join(root, "forge614.node.json"), "{ \"schemaVersion\": 2 }");
  expect(await checkRepository({ ...base(), root })).toMatchObject({ kind: "error", code: "NODE_POINTER_INVALID" });
});
