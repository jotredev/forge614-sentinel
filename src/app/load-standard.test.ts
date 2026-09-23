import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCacheEntry } from "../infrastructure/cache";
import { loadStandard } from "./load-standard";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
const OTHER = "0".repeat(64);
const enc = new TextEncoder();

function seeded(version = "1.0.0", sha256 = SHA): string {
  const root = mkdtempSync(join(tmpdir(), "sentinel-load-"));
  writeCacheEntry(root, { version, sha256, fetchedAt: "2026-09-23T10:00:00Z", members: [{ path: "VERSION", mode: 0o644, content: enc.encode(`${version}\n`) }] });
  return root;
}

test("loads a cached version whose manifest sha256 matches the expected one", () => {
  const r = loadStandard({ version: "1.0.0", expectedSha256: SHA, cacheRoot: seeded() });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.standard).toMatchObject({ version: "1.0.0", sha256: SHA, latestKnown: "1.0.0" });
  expect(r.standard.files.get("VERSION")).toBe("1.0.0\n");
});

test("a missing cache is STANDARD_UNAVAILABLE with the fetch command in the message", () => {
  const r = loadStandard({ version: "1.0.0", expectedSha256: SHA, cacheRoot: mkdtempSync(join(tmpdir(), "sentinel-load-")) });
  expect(r).toMatchObject({ ok: false, code: "STANDARD_UNAVAILABLE" });
  if (r.ok) return;
  expect(r.error).toContain("forge614-sentinel standard fetch 1.0.0");
});

test("a cached manifest with a different sha256 than expected is STANDARD_CORRUPT and nothing is loaded", () => {
  const r = loadStandard({ version: "1.0.0", expectedSha256: OTHER, cacheRoot: seeded() });
  expect(r).toMatchObject({ ok: false, code: "STANDARD_CORRUPT" });
});

test("an invalid manifest is STANDARD_CORRUPT", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-load-"));
  mkdirSync(join(root, "1.0.0/content"), { recursive: true });
  writeFileSync(join(root, "1.0.0/manifest.json"), "{}");
  expect(loadStandard({ version: "1.0.0", cacheRoot: root })).toMatchObject({ ok: false, code: "STANDARD_CORRUPT" });
});

test("without an expected sha256 (forced version) the cached fingerprint is trusted, and latestKnown is the highest cached", () => {
  const root = seeded("1.0.0", SHA);
  writeCacheEntry(root, { version: "1.1.0", sha256: OTHER, fetchedAt: "2026-09-23T10:00:00Z", members: [] });
  const r = loadStandard({ version: "1.0.0", cacheRoot: root });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.standard.sha256).toBe(SHA);
  expect(r.standard.latestKnown).toBe("1.1.0");
});
