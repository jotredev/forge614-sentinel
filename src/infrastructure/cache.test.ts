import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheRoot, cachedVersions, readCacheManifest, readCachedFiles, writeCacheEntry } from "./cache";

const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
const enc = new TextEncoder();

test("cacheRoot honors FORGE614_HOME and falls back to ~/.forge614", () => {
  expect(cacheRoot({ FORGE614_HOME: "/x/home" })).toBe(join("/x/home", "standard"));
  expect(cacheRoot({ HOME: "/Users/me" })).toBe(join("/Users/me", ".forge614", "standard"));
});

test("writeCacheEntry stores manifest.json and content/ atomically; readers find it", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-cache-"));
  writeCacheEntry(root, {
    version: "1.0.0",
    sha256: SHA,
    fetchedAt: "2026-09-23T10:00:00Z",
    members: [
      { path: "VERSION", mode: 0o644, content: enc.encode("1.0.0\n") },
      { path: "rules/", mode: 0o755 },
      { path: "rules/forge614-rule-x/manifest.json", mode: 0o644, content: enc.encode("{}") },
    ],
  });
  expect(readdirSync(root)).toEqual(["1.0.0"]); // no leftover temp dir
  expect(JSON.parse(readFileSync(join(root, "1.0.0/manifest.json"), "utf8"))).toEqual({ schemaVersion: 1, version: "1.0.0", sha256: SHA, fetchedAt: "2026-09-23T10:00:00Z" });
  expect(readCacheManifest(root, "1.0.0")).toEqual({ kind: "ok", manifest: { schemaVersion: 1, version: "1.0.0", sha256: SHA, fetchedAt: "2026-09-23T10:00:00Z" } });
  expect([...readCachedFiles(root, "1.0.0").keys()]).toEqual(["VERSION", "rules/forge614-rule-x/manifest.json"]);
  expect(cachedVersions(root)).toEqual(["1.0.0"]);
});

test("a missing or malformed manifest is reported, never thrown", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-cache-"));
  expect(readCacheManifest(root, "9.9.9")).toEqual({ kind: "missing" });
  mkdirSync(join(root, "1.0.0"), { recursive: true });
  writeFileSync(join(root, "1.0.0/manifest.json"), JSON.stringify({ schemaVersion: 1, version: "1.0.0", sha256: "zzz", fetchedAt: "x" }));
  const bad = readCacheManifest(root, "1.0.0");
  expect(bad.kind).toBe("invalid");
  writeFileSync(join(root, "1.0.0/manifest.json"), "{ not json");
  expect(readCacheManifest(root, "1.0.0").kind).toBe("invalid");
});

test("cachedVersions lists only semver folders, sorted numerically", () => {
  const root = mkdtempSync(join(tmpdir(), "sentinel-cache-"));
  for (const d of ["1.10.0", "1.2.0", "tmp-123", "notes.txt"]) mkdirSync(join(root, d), { recursive: true });
  expect(cachedVersions(root)).toEqual(["1.2.0", "1.10.0"]);
});
