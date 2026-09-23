import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readCacheManifest, writeCacheEntry } from "../infrastructure/cache";
import { fileFetcher, offlineFetcher, type Fetcher } from "../infrastructure/network";
import { standardSource } from "../modules/standard-source";
import { fetchStandard } from "./fetch-standard";
import { loadStandard } from "./load-standard";

const FIXTURES = resolve(import.meta.dir, "../../fixtures/standard");
const BASE = pathToFileURL(FIXTURES).href;
const SHA = "18d4455f6277374bf68938975cb1406f762f4ca9462b692f79bd01152b370922";
const OTHER = "0".repeat(64);
const now = () => new Date("2026-09-23T10:00:00Z");

function root(): string {
  return mkdtempSync(join(tmpdir(), "sentinel-fetch-"));
}

test("downloads SHA256SUMS and the archive from <base>/standard-v<version>/, verifies and extracts atomically", async () => {
  const cacheRoot = root();
  const r = await fetchStandard({ source: standardSource("1.0.0", SHA), cacheRoot, fetcher: fileFetcher(), releaseBase: BASE, now });
  expect(r).toEqual({ ok: true, version: "1.0.0", sha256: SHA, alreadyCached: false });
  expect(readCacheManifest(cacheRoot, "1.0.0")).toMatchObject({ kind: "ok", manifest: { sha256: SHA, fetchedAt: "2026-09-23T10:00:00.000Z" } });
  expect(readFileSync(join(cacheRoot, "1.0.0/content/VERSION"), "utf8")).toBe("1.0.0\n");
  expect(readdirSync(cacheRoot)).toEqual(["1.0.0"]);
});

test("a version already cached is not downloaded again", async () => {
  const cacheRoot = root();
  await fetchStandard({ source: standardSource("1.0.0"), cacheRoot, fetcher: fileFetcher(), releaseBase: BASE, now });
  let calls = 0;
  const counting: Fetcher = async (url) => {
    calls += 1;
    return fileFetcher()(url);
  };
  const r = await fetchStandard({ source: standardSource("1.0.0"), cacheRoot, fetcher: counting, releaseBase: BASE, now });
  expect(r).toMatchObject({ ok: true, alreadyCached: true });
  expect(calls).toBe(0);
});

test("a network failure is reason 'network' and leaves no cache entry", async () => {
  const cacheRoot = root();
  const r = await fetchStandard({ source: standardSource("1.0.0"), cacheRoot, fetcher: offlineFetcher(), releaseBase: BASE, now });
  expect(r).toMatchObject({ ok: false, reason: "network" });
  expect(readdirSync(cacheRoot)).toEqual([]);
});

test("an HTTP error (unknown version) is reason 'http'", async () => {
  const r = await fetchStandard({ source: standardSource("9.9.9"), cacheRoot: root(), fetcher: fileFetcher(), releaseBase: BASE, now });
  expect(r).toMatchObject({ ok: false, reason: "http" });
  if (r.ok) return;
  expect(r.error).toContain("404");
});

test("a SHA256SUMS that disagrees with the repository's declared sha256 is 'corrupt' before downloading the archive", async () => {
  let archiveRequested = false;
  const fetcher: Fetcher = async (url) => {
    if (url.endsWith(".tar.gz")) archiveRequested = true;
    return fileFetcher()(url);
  };
  const r = await fetchStandard({ source: standardSource("1.0.0", OTHER), cacheRoot: root(), fetcher, releaseBase: BASE, now });
  expect(r).toMatchObject({ ok: false, reason: "corrupt" });
  expect(archiveRequested).toBe(false);
});

test("an archive whose bytes do not match SHA256SUMS is 'corrupt' and nothing is written", async () => {
  const cacheRoot = root();
  const fetcher: Fetcher = async (url) => {
    const real = await fileFetcher()(url);
    if (!url.endsWith(".tar.gz")) return real;
    const bytes = new Uint8Array(real.bytes);
    const i = bytes.length - 1;
    bytes[i] = (bytes[i] ?? 0) ^ 0x01;
    return { ...real, bytes };
  };
  const r = await fetchStandard({ source: standardSource("1.0.0", SHA), cacheRoot, fetcher, releaseBase: BASE, now });
  expect(r).toMatchObject({ ok: false, reason: "corrupt" });
  expect(readdirSync(cacheRoot)).toEqual([]);
});

test("no cache and no network never falls back to another cached version", async () => {
  const cacheRoot = root();
  writeCacheEntry(cacheRoot, { version: "1.1.0", sha256: OTHER, fetchedAt: "2026-09-23T10:00:00Z", members: [] });
  const fetched = await fetchStandard({ source: standardSource("1.0.0", SHA), cacheRoot, fetcher: offlineFetcher(), releaseBase: BASE, now });
  expect(fetched).toMatchObject({ ok: false, reason: "network" });
  const loaded = loadStandard({ version: "1.0.0", expectedSha256: SHA, cacheRoot });
  expect(loaded).toMatchObject({ ok: false, code: "STANDARD_UNAVAILABLE" });
  if (loaded.ok) return;
  expect(loaded.error).toContain("forge614-sentinel standard fetch 1.0.0");
  expect(readdirSync(cacheRoot)).toEqual(["1.1.0"]);
});
