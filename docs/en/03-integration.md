# 03 — Integration

> Like the inspection seal at a shop's entrance: without it, it does not open.

## In every node's verify

The node's `verify` script runs, besides its own steps, `forge614-sentinel check --json` and fails if the verdict is `fail`. If the binary is not installed, `verify` fails with `SENTINEL_NOT_INSTALLED` and the install command; it does not warn and carry on. That change to every node's `verify` is not part of Sentinel 0.1: Plan A2 in `forge614-ai` and phase 0.4 in the other nodes do it. Sentinel is mandatory for developing ecosystem nodes and optional for third-party products built with the ecosystem (which receive `applicable: false`).

## In CI

The `verify.yml` template of standard 1.1.0 (Plan A2) adds a `bun run sentinel:install` step before `bun run verify`: it downloads the Sentinel release pinned in `forge614.node.json` (`sentinel.version`, a new optional field) for the runner's platform and verifies `SHA256SUMS`. Releases are public: without a token there is no write access. This repository does not install itself: its `verify` runs `check` from the source code (`bun run sentinel:check`) against the copy of the standard in `fixtures/standard/`, whose fingerprint is the one `forge614.node.json` pins. Sentinel accepts `sentinel.version` from 0.1.1 on; 0.1.0 rejects a pointer that carries it (`NODE_POINTER_INVALID`) because its schema is strict. A node therefore adds the field only when it pins 0.1.1 or later.

## Exit codes and errors

`0` with `pass`, with `caution` (except with `--strict`) and with `applicable: false`; `1` with `fail`, with `caution` under `--strict` and with `STANDARD_UNAVAILABLE`, `STANDARD_CORRUPT`, `STANDARD_FETCH_FAILED`, `CHECK_FAILED` or `SENTINEL_FAILED`; `2` with `INVALID_ARGUMENTS` and `NODE_POINTER_INVALID`. Error envelopes never include absolute paths or stack traces.

## Bootstrapping with forge614-ai

`forge614-ai` published standard 1.0.0; Sentinel was built from its templates and checks itself; once Sentinel 0.1 is published, `forge614-ai` adopts `check` in its `verify`, retires its validators and publishes standard 1.1.0 (a `verify.yml` template with Sentinel, `layout.json`, `stack.json`, `secret-patterns.json`). The other nodes adopt Sentinel in their next release (phase 0.4). A node may declare 1.0.0 while Sentinel already knows 1.1.0: it is checked with the declared version.
