import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_RELEASE_BASE, fetcherFromEnv, fileFetcher, releaseBaseFromEnv } from "./network";

test("release base defaults to the forge614-ai releases URL and can be overridden", () => {
  expect(releaseBaseFromEnv({})).toBe(DEFAULT_RELEASE_BASE);
  expect(releaseBaseFromEnv({ FORGE614_SENTINEL_RELEASE_BASE: "file:///tmp/x/" })).toBe("file:///tmp/x");
});

test("fileFetcher serves file:// URLs from disk with ok/status and 404 for a missing file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sentinel-net-"));
  mkdirSync(join(dir, "standard-v1.0.0"));
  writeFileSync(join(dir, "standard-v1.0.0/SHA256SUMS"), "abc\n");
  const base = pathToFileURL(dir).href;
  const hit = await fileFetcher()(`${base}/standard-v1.0.0/SHA256SUMS`);
  expect(hit).toMatchObject({ ok: true, status: 200 });
  expect(new TextDecoder().decode(hit.bytes)).toBe("abc\n");
  expect(await fileFetcher()(`${base}/standard-v1.0.0/nope`)).toMatchObject({ ok: false, status: 404 });
});

test("FORGE614_SENTINEL_OFFLINE=1 yields a fetcher that rejects like a network failure", async () => {
  await expect(fetcherFromEnv({ FORGE614_SENTINEL_OFFLINE: "1" })("https://x")).rejects.toThrow(/offline/);
});

test("a file:// base selects the file fetcher even without OFFLINE", async () => {
  const fetcher = fetcherFromEnv({ FORGE614_SENTINEL_RELEASE_BASE: "file:///nowhere" });
  expect(await fetcher("file:///nowhere/x")).toMatchObject({ ok: false, status: 404 });
});
