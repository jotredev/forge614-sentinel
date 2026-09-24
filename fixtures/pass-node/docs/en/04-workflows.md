# 04 — Integration and release workflows

> Like a flight's checklist: every step is written down, runs the same on the ground (local) as in the air (CI), and no one takes off without completing it.

## `verify.yml`
| Job | Trigger | What it runs | What it validates | Expected duration |
| --- | --- | --- | --- | --- |
| `verify` | push to `main`, pull request | `bun install --frozen-lockfile`, `bun run verify` | typecheck, tests, standard validators, workflows | ~3 min |

## `release.yml`
| Job | Trigger | What it runs | What it publishes | Expected duration |
| --- | --- | --- | --- | --- |
| `build` | tag `v*` | `bun run build:target`, `bun run smoke:target` on macOS arm64/x64, Linux arm64/x64, Windows x64 | per-platform artifacts | ~8 min |
| `publish` | after `build` | `bun run release:publish` | release with binaries and `SHA256SUMS` | ~1 min |

Every job declares `timeout-minutes` (`verify`: 10; `build`: 20; `publish`: 10): no stage runs without a limit and `bun run workflows:check` rejects a job that lacks it.

**Precondition of `release.yml`:** a node with `file:../` dependencies to sibling repositories in its `package.json` cannot adopt this template; the workflow checks out a single repository, so `bun install --frozen-lockfile` would fail against that path dependency. Replace it with the published version of the sibling node before adopting the template.

## Running locally
`bun run workflows:run --workflow verify` runs, in order, the same scripts the `verify` job runs. The `pre-push` hook does this automatically.

## Pinned actions
| Action | Version | SHA |
| --- | --- | --- |
| actions/checkout | v4.3.1 | 34e114876b0b11c390a56381ad16ebd13914f8d5 |
| oven-sh/setup-bun | v2.0.2 | 735343b667d3e6f658f44d0eca948eb6282f2b76 |
| actions/upload-artifact | v4.6.2 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| actions/download-artifact | v4.3.0 | d3f86a106a0bac45b974a628896c90dbdf5c8093 |
