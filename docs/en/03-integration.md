# 03 — Integration

> Like the inspection seal at a shop's entrance: without it, it does not open.

## Install, update and uninstall

On macOS and Linux, install with `curl -fsSL https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.sh | bash`; in Windows PowerShell, use `irm https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.ps1 | iex`. Node.js 22.19.0 or later is required. `forge614-sentinel update` and `forge614-sentinel uninstall` use the latest release gatekeeper; `forge614-sentinel uninstall --self` exits without changes because Sentinel has no assistant integrations.

## In every node's verify

The node's `verify` script runs, besides its own steps, `forge614-sentinel check --json` and fails if the verdict is `fail`. If the binary is not installed, `verify` fails with `SENTINEL_NOT_INSTALLED` and the install command; it does not warn and carry on. That change to every node's `verify` is not part of Sentinel 0.1: Plan A2 in `forge614-ai` and phase 0.4 in the other nodes do it. Sentinel is mandatory for developing ecosystem nodes and optional for third-party products built with the ecosystem (which receive `applicable: false`).

## In CI

Releases are public: installing Sentinel does not require a GitHub token. This repository checks itself from source and uses `fixtures/standard/standard-v1.2.1/` so `verify` works without a network connection. `forge614.node.json` pins the standard version and fingerprint; the installer never chooses another version on its own.

## Exit codes and errors

`0` with `pass`, with `caution` (except with `--strict`) and with `applicable: false`; `1` with `fail`, with `caution` under `--strict` and with check errors, `UPDATE_FAILED` or `UNINSTALL_FAILED`; `2` with invalid arguments or an invalid pointer; `130` when `uninstall` is cancelled. Error envelopes never include absolute paths or stack traces.

## Bootstrapping with forge614-ai

Standard 1.2.1 defines the shared installer. Sentinel 0.2.1 is the first node to adopt it: its two gatekeepers verify the shared `install.mjs` and pointer before running it. The remaining nodes adopt it in the ecosystem's agreed order; Sentinel accepts pointers from nodes using either the old or new template.
