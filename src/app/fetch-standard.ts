import { extractTarGz } from "../infrastructure/archive";
import { readCacheManifest, writeCacheEntry } from "../infrastructure/cache";
import { sha256Hex } from "../infrastructure/hashing";
import type { Fetcher } from "../infrastructure/network";
import { parseSha256Sums } from "../modules/schemas/sha256sums";
import type { StandardSource } from "../modules/standard-source";
import type { TarMember } from "../modules/tar-reader";

export type FetchStandardResult =
  | { ok: true; version: string; sha256: string; alreadyCached: boolean }
  | { ok: false; reason: "network" | "http" | "corrupt"; error: string };

export interface FetchStandardOptions {
  source: StandardSource;
  cacheRoot: string;
  fetcher: Fetcher;
  releaseBase: string;
  now?: () => Date;
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Order matters (spec §5.4): SHA256SUMS first, compared with what the
// repository declares (a disagreement means the release changed or the
// pointer was edited by hand, and there is no point downloading), then the
// archive, whose bytes must hash to the listed value before anything is
// written. The cache entry appears in one rename or not at all.
export async function fetchStandard(options: FetchStandardOptions): Promise<FetchStandardResult> {
  const { version } = options.source;
  const expectedSha256 = options.source.sha256;
  const existing = readCacheManifest(options.cacheRoot, version);
  if (existing.kind === "ok" && (expectedSha256 === undefined || existing.manifest.sha256 === expectedSha256)) {
    return { ok: true, version, sha256: existing.manifest.sha256, alreadyCached: true };
  }

  const base = `${options.releaseBase}/standard-v${version}`;
  const archiveName = `standard-${version}.tar.gz`;
  const get = async (name: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; result: FetchStandardResult }> => {
    let response: Awaited<ReturnType<Fetcher>>;
    try {
      response = await options.fetcher(`${base}/${name}`);
    } catch (error) {
      return { ok: false, result: { ok: false, reason: "network", error: `could not download ${name} for standard ${version}: ${error instanceof Error ? error.message : String(error)}` } };
    }
    if (!response.ok) return { ok: false, result: { ok: false, reason: "http", error: `release standard-v${version} did not serve ${name} (HTTP ${response.status})` } };
    return { ok: true, bytes: response.bytes };
  };

  const sums = await get("SHA256SUMS");
  if (!sums.ok) return sums.result;
  const listed = parseSha256Sums(decode(sums.bytes))?.find((e) => e.file === archiveName);
  if (listed === undefined) return { ok: false, reason: "corrupt", error: `SHA256SUMS of release standard-v${version} does not list ${archiveName}` };
  if (expectedSha256 !== undefined && listed.sha256 !== expectedSha256) {
    return { ok: false, reason: "corrupt", error: `release standard-v${version} of ${options.source.repository} publishes sha256 ${listed.sha256} but the repository declares ${expectedSha256}` };
  }

  const archive = await get(archiveName);
  if (!archive.ok) return archive.result;
  const actual = sha256Hex(archive.bytes);
  if (actual !== listed.sha256) return { ok: false, reason: "corrupt", error: `${archiveName} hashes to ${actual}, SHA256SUMS says ${listed.sha256}` };

  let members: TarMember[];
  try {
    members = extractTarGz(archive.bytes);
  } catch (error) {
    return { ok: false, reason: "corrupt", error: `${archiveName} could not be extracted: ${error instanceof Error ? error.message : String(error)}` };
  }
  writeCacheEntry(options.cacheRoot, { version, sha256: actual, members, fetchedAt: (options.now ?? (() => new Date()))().toISOString() });
  return { ok: true, version, sha256: actual, alreadyCached: false };
}
