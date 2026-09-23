import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CacheManifestSchema, type CacheManifest } from "../modules/schemas/cache-manifest";
import { compareSemver, SEMVER_PATTERN } from "../modules/semver";
import type { TarMember } from "../modules/tar-reader";
import { writeTextAtomic, writeTreeAtomic } from "./fs-write";
import { walkTree } from "./fs-tree";

// <FORGE614_HOME or ~/.forge614>/standard/<version>/{manifest.json, content/…}
// (spec §5.4). The env is a parameter so tests never touch the real home.
export function cacheRoot(env: Record<string, string | undefined> = process.env): string {
  const home = env.FORGE614_HOME !== undefined && env.FORGE614_HOME !== "" ? env.FORGE614_HOME : join(env.HOME ?? homedir(), ".forge614");
  return join(home, "standard");
}

export type ManifestRead = { kind: "missing" } | { kind: "invalid"; error: string } | { kind: "ok"; manifest: CacheManifest };

export function readCacheManifest(root: string, version: string): ManifestRead {
  const path = join(root, version, "manifest.json");
  if (!existsSync(path)) return { kind: "missing" };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { kind: "invalid", error: `manifest.json of standard ${version} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const parsed = CacheManifestSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid", error: `manifest.json of standard ${version} does not match CacheManifestSchema` };
  return { kind: "ok", manifest: parsed.data };
}

export function readCachedFiles(root: string, version: string): ReadonlyMap<string, string> {
  return walkTree(join(root, version, "content")).files;
}

export function cachedVersions(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => SEMVER_PATTERN.test(name) && statSync(join(root, name)).isDirectory())
    .sort(compareSemver);
}

export function writeCacheEntry(root: string, entry: { version: string; sha256: string; members: readonly TarMember[]; fetchedAt: string }): void {
  mkdirSync(root, { recursive: true });
  const files = new Map<string, Uint8Array>();
  for (const member of entry.members) if (member.content !== undefined) files.set(join("content", member.path), member.content);
  const manifest: CacheManifest = { schemaVersion: 1, version: entry.version, sha256: entry.sha256, fetchedAt: entry.fetchedAt };
  files.set("manifest.json", new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`));
  writeTreeAtomic(join(root, entry.version), files, join(root, `${entry.version}.tmp-${process.pid}`));
}

// Exposed for standard-fetch's `--json` output of where things landed,
// without leaking absolute paths into error envelopes.
export function describeCacheLocation(version: string): string {
  return `<FORGE614_HOME>/standard/${version}`;
}

export { writeTextAtomic };
