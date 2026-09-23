import { expect, test } from "bun:test";
import { CacheManifestSchema } from "./cache-manifest";

const valid = { schemaVersion: 1, version: "1.0.0", sha256: "a".repeat(64), fetchedAt: "2026-09-23T10:00:00Z" } as const;

test("accepts a manifest with an ISO-8601 UTC timestamp, with or without fractional seconds", () => {
  expect(CacheManifestSchema.safeParse(valid).success).toBe(true);
  expect(CacheManifestSchema.safeParse({ ...valid, fetchedAt: "2026-09-23T10:00:00.123Z" }).success).toBe(true);
});

test("rejects unknown keys", () => {
  expect(CacheManifestSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
});

test("rejects a non-UTC timestamp, a bad version and a bad sha256", () => {
  expect(CacheManifestSchema.safeParse({ ...valid, fetchedAt: "2026-09-23T10:00:00+02:00" }).success).toBe(false);
  expect(CacheManifestSchema.safeParse({ ...valid, version: "v1.0" }).success).toBe(false);
  expect(CacheManifestSchema.safeParse({ ...valid, sha256: "xyz" }).success).toBe(false);
});
