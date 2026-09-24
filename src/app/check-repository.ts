import { readCacheManifest } from "../infrastructure/cache";
import type { Fetcher } from "../infrastructure/network";
import { CHECKS, NATIVE_CHECK_IDS } from "../modules/checks";
import type { CheckReport, NotApplicableReport } from "../modules/report";
import { standardSource } from "../modules/standard-source";
import { buildCheckParams } from "./build-check-params";
import { buildReport } from "./build-report";
import { classifyRepository } from "./classify-repository";
import { fetchStandard } from "./fetch-standard";
import { loadStandard, type LoadStandardResult } from "./load-standard";
import { runChecks, selectChecks } from "./run-checks";
import { takeSnapshot } from "./take-snapshot";

export interface CheckRepositoryOptions {
  root: string;
  standardVersion?: string;
  only?: readonly string[];
  cacheRoot: string;
  fetcher: Fetcher;
  releaseBase: string;
  today: string;
  sentinelVersion: string;
  clock?: () => number;
}

export type CheckRepositoryResult =
  | { kind: "report"; report: CheckReport; crashed: string[] }
  | { kind: "not-applicable"; report: NotApplicableReport }
  | { kind: "error"; code: "NODE_POINTER_INVALID" | "STANDARD_UNAVAILABLE" | "STANDARD_CORRUPT" | "STANDARD_FETCH_FAILED"; error: string };

// The whole use case, in the order the spec fixes: identity (§4), standard
// resolution and cache (§5), one snapshot, the checks (§8), the report
// (§6). Network can only happen in `fetchStandard`, before any check runs.
export async function checkRepository(options: CheckRepositoryOptions): Promise<CheckRepositoryResult> {
  const clock = options.clock ?? (() => performance.now());
  const started = clock();

  const classification = classifyRepository(options.root);
  if (classification.kind === "invalid-pointer") return { kind: "error", code: "NODE_POINTER_INVALID", error: classification.error };
  if (classification.kind !== "node") return { kind: "not-applicable", report: { schemaVersion: 1, applicable: false, reason: classification.kind } };
  const { pointer } = classification;

  // `forced` is "the flag was given" (the report says so even when the
  // forced version equals the declared one); the pointer's fingerprint is
  // only an expectation when the version is the declared one.
  const forced = options.standardVersion !== undefined;
  const version = options.standardVersion ?? pointer.standard.version;
  const sameAsPointer = version === pointer.standard.version;
  const load: { expectedSha256?: string; cacheRoot: string; version: string } = sameAsPointer
    ? { version, cacheRoot: options.cacheRoot, expectedSha256: pointer.standard.sha256 }
    : { version, cacheRoot: options.cacheRoot };

  let fetched = false;
  let loaded: LoadStandardResult = loadStandard(load);
  if (!loaded.ok && loaded.code === "STANDARD_UNAVAILABLE") {
    const source = load.expectedSha256 === undefined ? standardSource(version) : standardSource(version, load.expectedSha256);
    const result = await fetchStandard({ source, cacheRoot: options.cacheRoot, fetcher: options.fetcher, releaseBase: options.releaseBase });
    if (!result.ok) {
      if (result.reason === "network") return { kind: "error", code: "STANDARD_UNAVAILABLE", error: `${loaded.error} (${result.error})` };
      return { kind: "error", code: result.reason === "corrupt" ? "STANDARD_CORRUPT" : "STANDARD_FETCH_FAILED", error: result.error };
    }
    fetched = true;
    loaded = loadStandard(load);
  }
  if (!loaded.ok) return { kind: "error", code: loaded.code, error: loaded.error };

  const pointerManifest = sameAsPointer ? undefined : readCacheManifest(options.cacheRoot, pointer.standard.version);
  const pointerVersionSha256 = sameAsPointer ? loaded.standard.sha256 : pointerManifest?.kind === "ok" ? pointerManifest.manifest.sha256 : undefined;

  const params = buildCheckParams({
    standard: loaded.standard,
    pointer,
    pointerVersionSha256,
    today: options.today,
    sentinelVersion: options.sentinelVersion,
    knownCheckIds: CHECKS.map((c) => c.id),
  });
  if (!params.ok) return { kind: "error", code: params.code, error: params.error };

  const snapshot = takeSnapshot(options.root);
  const selection = selectChecks(params.params, CHECKS, NATIVE_CHECK_IDS, options.only);
  const { entries, crashed } = await runChecks(snapshot, params.params, selection);

  const report = buildReport({
    sentinelVersion: options.sentinelVersion,
    standard: { version, sha256: loaded.standard.sha256, forced, fetched, latestKnown: loaded.standard.latestKnown },
    repositoryName: pointer.node,
    entries,
    durationMs: Math.max(0, Math.round(clock() - started)),
  });
  return { kind: "report", report, crashed };
}
