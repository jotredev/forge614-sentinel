# 02 — Standard and cache

> Like the sealed copy of the code in the municipal archive: the seal is checked before use and it is never corrected by hand.

## Where the standard comes from

From the `standard-v<version>` release of `jotredev/forge614-ai`: `standard-<version>.tar.gz` and `SHA256SUMS`. The source is data (`{ kind: "github-release", repository, version, sha256 }`); in 0.1 the repository is fixed and only the version and the fingerprint come from the repository being checked (`forge614.node.json`, fields `standard.version` and `standard.sha256`). `--standard <version>` forces another version and the report marks it with `forced: true`. Sentinel never picks "the newest".

## The local cache

`<FORGE614_HOME or ~/.forge614>/standard/<version>/` with `manifest.json` (`{ schemaVersion: 1, version, sha256, fetchedAt }`) and `content/` (the extracted package). Writing is atomic: it is extracted into a temporary folder and renamed; there is never a half-written entry. `forge614-sentinel standard fetch [<version>]` fills it by hand; `check` fills it by itself the first time the requested version is missing.

## Fingerprint verification

Before accepting a package its sha256 is compared with the one in `SHA256SUMS` and with the one the repository being checked declares; if they differ, `STANDARD_CORRUPT` and nothing is stored. When loading from the cache, `manifest.sha256` is compared again with the declared fingerprint. That is why, if the pointer's fingerprint does not match the release's or the cache's (the pointer was edited by hand or the release changed), the result is `STANDARD_CORRUPT` before any check runs: there is no report, only the error envelope. The `node-pointer` check covers the remaining case, a run forced with `--standard`: it cross-checks the repository's `standard.sha256` with the cached fingerprint of the version the pointer declares and gives `fail` if they differ, or `caution` if that version is not cached.

## Offline

With the requested version in the cache, `check` uses no network. Without a cache and without network, `STANDARD_UNAVAILABLE` with the command to obtain it; a run is never done with another version "by approximation". If a newer version than the one the node declares is in the cache, the report notes it in `standard.latestKnown` without using it. Two environment variables exist only for tests and CI without network: `FORGE614_SENTINEL_RELEASE_BASE` (a `file://` URL with the same structure as the release) and `FORGE614_SENTINEL_OFFLINE=1`.
