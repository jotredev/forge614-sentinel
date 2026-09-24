# Contract of Forge614 Sentinel (`forge614-sentinel`)

> One-sentence analogy: like a municipal inspector, it arrives with the current code, inspects, hands over the report and leaves; it does not build or repair.

## Purpose
Check any repository of the ecosystem against the Node Standard it declares and return a report with a verdict and evidence, the same on Linux, macOS and Windows.

## What it does
- Classifies the repository by identity files (`forge614.node.json`, `.forge614/project.json`) and checks only ecosystem nodes.
- Obtains, verifies (sha256) and caches the standard the node declares; it never picks another version on its own.
- Runs the 19 checks of Sentinel 0.1 (document 01) selected by the standard's pack and produces `CheckReport` (`schemaVersion: 1`).
- Checks itself in `verify` and tests the report's parity on three systems.

## What it does not do
- It does not write to the repository being checked or fix anything.
- It uses no network during the checks; only to download the standard that is missing from the cache.
- It does not check third-party projects or third-party standards (future deliveries); it does not run the node (`import-rules`, `boundaries-zod`, `machine-contracts` arrive in 0.2).

## Dependencies
| Node or binary | How it is consumed | Minimum version |
| --- | --- | --- |
| Bun | development runtime and `bun build --compile`; pinned in the workflows (decision 0026) | 1.4.2 (CI); `engines.bun >= 1.3.9` |
| TypeScript | `devDependency`; `bun run typecheck` | 5.9.3 |
| zod | schemas at every boundary | 4.6.5 |
| fflate | `gunzipSync` for the standard; `gzipSync`/`zipSync` for the release artifacts | 0.8.3 |
| yaml | reading workflows | 2.8.1 |
| git | read-only (`ls-files`, `tag`, `log`), optional: without git the disk is walked | any |
| gh | only in `release:publish` (GitHub runner) | 2.x |
| forge614-ai | release `standard-v<version>` (package + `SHA256SUMS`) | 1.0.0 |

## Public commands
| Command | Input (schema) | Output (schema) | `schemaVersion` | Exit codes |
| --- | --- | --- | --- | --- |
| `forge614-sentinel check` | `[--repo <path>] [--standard <X.Y.Z>] [--only <id,id>] [--strict] [--json]` | `CheckReport` or `{ applicable: false, reason }` | `1` | `0` pass, caution, not applicable; `1` fail, caution with `--strict`, `STANDARD_UNAVAILABLE`, `STANDARD_CORRUPT`, `STANDARD_FETCH_FAILED`, `CHECK_FAILED`, `SENTINEL_FAILED`; `2` `INVALID_ARGUMENTS`, `NODE_POINTER_INVALID` |
| `forge614-sentinel standard fetch` | `[<X.Y.Z>] [--json]` (without a version it uses `./forge614.node.json`) | `{ version, sha256, alreadyCached, location }` | `1` | `0`; `1` `STANDARD_FETCH_FAILED`, `STANDARD_CORRUPT`, `SENTINEL_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run verify` | `[--skip-tests]` | `{ ok: true, steps, sentinel: { verdict, durationMs } }` | `1` | `0`; `1` `VERIFY_STEP_FAILED`, `VERIFY_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run sentinel:check` | none (alias of `check --repo . --json`) | `CheckReport` | `1` | those of `check` |
| `bun run sentinel:parity` | `[--update]` | `{ ok: true, compared }` | `1` | `0`; `1` `PARITY_MISMATCH`, `PARITY_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run workflows:check` | none | `{ verdict, evidence }` | `1` | `0` pass; `1` otherwise or `WORKFLOWS_CHECK_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run workflows:run` | `[--workflow <name>]` | `{ workflow, jobs, ok }` | `1` | `0`; `1` failed step, `WORKFLOW_NOT_FOUND`, `WORKFLOWS_RUN_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run notion-map:build` | `[--check]` | `{ path, pages }` or `{ ok: true, path }` | `1` | `0`; `1` `NOTION_MAP_DRIFT`, `NOTION_MAP_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run build:target` | `[--target <t>]` or `FORGE614_TARGET` | `{ target, binary, archive, sha256 }` | `1` | `0`; `1` `BUILD_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run smoke:target` | `[--target <t>]` or `FORGE614_TARGET` | `{ target, version, steps }` | `1` | `0`; `1` `SMOKE_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run release:publish` | `[--tag vX.Y.Z] [--dry-run]` (without `--tag` it uses `GITHUB_REF_NAME`) | `{ tag, version, assets, command, published }` | `1` | `0`; `1` `RELEASE_TAG_MISMATCH`, `RELEASE_ASSETS_MISSING`, `RELEASE_PUBLISH_FAILED`; `2` `INVALID_ARGUMENTS` |

Every data output is a single JSON object on stdout with `schemaVersion: 1`; every error is `{ schemaVersion: 1, code, error }` on stderr without absolute paths; no command prints a stack trace. All of them accept `--help` (prints `{ usage }`) and `--version` (`{ name: "forge614-sentinel", version }`) before parsing any other argument. Environment variables: `FORGE614_HOME` (cache root), and only for tests and CI without network, `FORGE614_SENTINEL_RELEASE_BASE`, `FORGE614_SENTINEL_OFFLINE`, `FORGE614_SENTINEL_CRASH_CHECK`.

## Error codes
| Code | Meaning |
| --- | --- |
| `INVALID_ARGUMENTS` | unknown flag, invalid value, `--only` with a nonexistent id, unexpected positional argument; exit `2` |
| `NODE_POINTER_INVALID` | `forge614.node.json` does not satisfy `NodePointerSchema`; exit `2` |
| `STANDARD_UNAVAILABLE` | the declared version is not in the cache and there is no network; the message carries the `standard fetch` command |
| `STANDARD_CORRUPT` | the package fingerprint (downloaded or cached) does not match the requested one or `SHA256SUMS`; nothing is stored |
| `STANDARD_FETCH_FAILED` | network or release error while downloading the standard |
| `CHECK_FAILED` | a check threw an exception; the full report is still printed with verdict `fail` |
| `SENTINEL_FAILED` | unexpected error outside the checks |
| `VERIFY_STEP_FAILED` | a `verify` step ended with a non-`0` exit or `sentinel:check` did not give `pass` |
| `VERIFY_FAILED` | `verify`: unexpected error |
| `WORKFLOWS_CHECK_FAILED` | `workflows:check`: unexpected error |
| `WORKFLOWS_RUN_FAILED` | `workflows:run`: unexpected error |
| `WORKFLOW_NOT_FOUND` | `workflows:run`: the requested workflow does not exist or does not satisfy `WorkflowSchema` |
| `NOTION_MAP_DRIFT` | `notion-map:build --check`: `docs/notion-map.json` does not match the fresh map |
| `NOTION_MAP_FAILED` | `notion-map:build`: unexpected error |
| `PARITY_MISMATCH` | `sentinel:parity`: a fixture's report differs from its golden |
| `PARITY_FAILED` | `sentinel:parity`: unexpected error |
| `BUILD_FAILED` | `build:target`: `bun build --compile` failed |
| `SMOKE_FAILED` | `smoke:target`: the binary does not answer `--version`/`--help` or `check` on the fixture does not give `pass` |
| `RELEASE_TAG_MISMATCH` | `release:publish`: the tag is not `v<package.json.version>` |
| `RELEASE_ASSETS_MISSING` | `release:publish`: one of the five artifacts is missing |
| `RELEASE_PUBLISH_FAILED` | `release:publish`: `gh` could not run or the release was not created |

## Mandatory requirements for supported AI assistants
`sentinel` section of `standard/procedures/new-agent-checklist.md` (standard 1.0.0): it does not exist because Sentinel does not integrate AI assistants; assistants consume its JSON report like any other tool.

## Compatibility
Breaking changes bump `schemaVersion`; one compatibility version is kept. `CheckReport` evolves additively (decision 0024): new fields are optional, never renamed or removed.
