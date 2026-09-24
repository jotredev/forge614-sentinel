# 00 — Summary and quickstart

> Like a municipal inspector: arrives with the current code under the arm, inspects the building, hands over a report of what complies and what does not, and leaves. It does not build, repair or decide what to do with the report.

## What forge614-sentinel is

`forge614-sentinel` is the verifier of the Forge614 ecosystem. It checks a repository against the Node Standard that the repository declares in `forge614.node.json` and returns a report with one verdict per check (`pass`, `caution`, `fail`, `not-applicable`) and one overall verdict. Sentinel **judges, never does**: it does not write to the repository it checks, it fixes nothing and it does not choose the standard on its own.

It decides what to do only from identity files (decision 0023): with a valid `forge614.node.json` it checks; with `.forge614/project.json` it answers `applicable: false, reason: "external-project"`; with neither, `not-a-forge614-repo`. Never from the folder name or from Git remotes.

## Install and run in one minute

macOS / Linux: `curl -fsSL https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.sh | bash`. Windows: `irm https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.ps1 | iex`. The installer places the binary in `~/.forge614/sentinel/<version>/` and the launcher in `~/.forge614/sentinel/bin/forge614-sentinel`; it verifies the fingerprint published in `SHA256SUMS` before installing.

At the root of a node: `forge614-sentinel check --json`. The first time it downloads the declared standard (document 02); later runs use no network. Exit code `0` with `pass` or `caution`, `1` with `fail`, `2` with invalid arguments.

## What the report contains

A single JSON object on stdout with `schemaVersion: 1`: the Sentinel version, the standard used (version, fingerprint, whether it was forced with `--standard`, whether it was downloaded in this run and, when it exists, `latestKnown`), the repository (`kind: "node"`, `name`), the overall verdict (the worst of the applied checks), the list of checks with `id`, `verdict`, `applied`, `evidence` and `message` in Spanish and English, and `durationMs`. Errors go to stderr as `{ schemaVersion, code, error }`; the codes are in `CONTRACT.en.md`.

## Where to read next

- Document 01: the 19 checks and how the ones that run are chosen.
- Document 02: where the standard comes from, the cache and the fingerprints.
- Document 03: how it fits into every node's `verify` and into CI.
- Document 04: the workflows of this repository.
- `CONTRACT.en.md`: commands, outputs and error codes.
