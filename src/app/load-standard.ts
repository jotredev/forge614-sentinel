import { cachedVersions, readCacheManifest, readCachedFiles } from "../infrastructure/cache";
import { highestSemver } from "../modules/semver";

export interface LoadedStandard {
  version: string;
  sha256: string;
  files: ReadonlyMap<string, string>;
  latestKnown: string;
}

export type LoadStandardResult =
  | { ok: true; standard: LoadedStandard }
  | { ok: false; code: "STANDARD_UNAVAILABLE" | "STANDARD_CORRUPT"; error: string };

export function fetchHint(version: string): string {
  return `run: forge614-sentinel standard fetch ${version}`;
}

// Reads the requested version from the local cache and nothing else (spec
// §5.5): no network here, never another version "by approximation". The
// expected sha256 comes from the inspected repository's pointer; when the
// version was forced there is none and the manifest's own fingerprint (which
// fetchStandard verified against SHA256SUMS) is reported.
export function loadStandard(options: { version: string; expectedSha256?: string; cacheRoot: string }): LoadStandardResult {
  const read = readCacheManifest(options.cacheRoot, options.version);
  if (read.kind === "missing") {
    return { ok: false, code: "STANDARD_UNAVAILABLE", error: `standard ${options.version} is not in the local cache; ${fetchHint(options.version)}` };
  }
  if (read.kind === "invalid") return { ok: false, code: "STANDARD_CORRUPT", error: read.error };
  if (options.expectedSha256 !== undefined && read.manifest.sha256 !== options.expectedSha256) {
    return {
      ok: false,
      code: "STANDARD_CORRUPT",
      error: `cached standard ${options.version} has sha256 ${read.manifest.sha256} but the repository declares ${options.expectedSha256}; remove the cache entry and ${fetchHint(options.version)}`,
    };
  }
  const files = readCachedFiles(options.cacheRoot, options.version);
  const latestKnown = highestSemver([...cachedVersions(options.cacheRoot), options.version]) ?? options.version;
  return { ok: true, standard: { version: options.version, sha256: read.manifest.sha256, files, latestKnown } };
}
