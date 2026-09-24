# 01 — Checks

> Like an inspector's checklist: every item has a number, a criterion and a box.

## How the set of checks is chosen

The standard's pack (`packs/forge614-pack-ecosystem-node/pack.json`) names rules; each rule may declare a `validator` in its `manifest.json`. Sentinel runs the checks those validators name (with a map of old names: `bilingual-docs` → `docs-parity`, `decision-records` → `decisions`) plus the native checks that standard 1.0.0 does not name yet (standard 1.1.0 names them explicitly). If the pack asks for a validator that this Sentinel version does not implement, a `caution` entry appears with `SENTINEL_OUTDATED` in its evidence: it is never silently skipped. `--only <id,id>` narrows the run; an unknown id is `INVALID_ARGUMENTS`.

Every check declares when it applies (`appliesWhen`); if it does not apply, the entry says `not-applicable` with the reason and does not count toward the overall verdict. No check returns `pass` because it does not know.

## The 11 ported checks

They come from the validators of `forge614-ai` with the same evidence:

| Id | What it checks |
| --- | --- |
| `package-naming` | folders under `standard/rules`, `standard/packs` and Hub packages under `.agents/` named `origin-kind-name` |
| `forbidden-mentions` | no term from the standard's `forbidden-mentions.json` in the tree (except excluded paths) |
| `docs-parity` | `README`, `CONTRACT`, `docs/es/NN-*`/`docs/en/NN-*` pairs with the same number of headings and the same numbering |
| `decisions` | decision records numbered without gaps, valid states, mandatory sections and a coherent `INDEX.json` |
| `agent-checklist-impact` | every closed plan in `.agents/plans/` declares `Sí`/`No` and explains the impact on the agents procedure |
| `error-codes` | codes in `CONTRACT.md` and in `printError(...)` written as `UPPER_CASE_WITH_UNDERSCORES` |
| `support-matrix` | valid `standard/support-matrix.json` with no overdue cells in revalidation (`forge614-ai` only) |
| `workflows` | thin workflows: an existing `bun run <script>`, actions pinned by SHA, `timeout-minutes`, documented jobs |
| `context-budget` | the estimated sum of the pack index does not exceed 3000 tokens (`forge614-ai` only) |
| `ecosystem-contract` | a local copy of `FORGE614_ECOSYSTEM_CONTRACT.md`, if present, is identical to the published one |
| `rules-catalog` | valid rule manifests and `pack.json`, folders named after their content, known validators (`forge614-ai` only) |

## The 8 new checks

| Id | What it checks | Where the parameters come from |
| --- | --- | --- |
| `node-pointer` | valid `forge614.node.json` and a `standard.sha256` equal to the fingerprint of the cached package for that version | cache |
| `layout` | mandatory folders and files of STANDARD §2; nothing in `scripts/` that duplicates a template | list built into Sentinel with 1.0.0 (evidence `source: builtin`); `layout.json` in 1.1.0 (the evidence says which) |
| `stack` | `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `any` in type position and `@ts-ignore`/`@ts-expect-error` directives forbidden in `src/` (tests excluded; comments, strings and regular expressions do not count); `bun.lock`; `engines.bun` ≥ 1.3.9 | list built into Sentinel with 1.0.0 (`source: builtin`); `stack.json` in 1.1.0 |
| `secrets-hygiene` | secret patterns (private keys, tokens with a known prefix, connection strings with credentials) and `.env` files with real values; it reports only the pattern and the line, never the value | list built into Sentinel with 1.0.0 (`source: builtin`); `secret-patterns.json` in 1.1.0 |
| `node-contract` | `CONTRACT.md` and `CONTRACT.en.md` with the same rows; in both directions: every `bun run <script>` in the table exists in `package.json` and every script the `verify.yml` and `release.yml` templates invoke appears in the table; every code in the table appears in `src/interfaces/cli` and every CLI code is in the table | the standard's templates (which scripts are public) |
| `installer` | `install.sh` and `install.ps1` identical to the template rendered with the node's variables; the standard version is the one `forge614.node.json` declares, also in a run forced with `--standard` (`forge614-ai` exempt) | the standard's templates |
| `release` | `verify.yml` and `release.yml` with the template's jobs intact, actions pinned by SHA, `CHANGELOG.md` present; only jobs added from an explicit list (`parity`) are allowed | the standard's templates; list of added jobs built into Sentinel |
| `versions` | exact equality between `package.json.version`, `docs/notion-map.json.productVersion` and, when the checkout has `v*` tags, the highest one | — |

## Verdicts and evidence

`pass` without problems (it may carry informational evidence, for example which built-in list was used); `caution` when Sentinel can neither affirm nor deny (a fingerprint that cannot be cross-checked in a forced run, an unknown validator); `fail` with concrete evidence (`path:line: reason`); `not-applicable` with a reason. A check that throws an exception is reported as `fail` with `CHECK_FAILED: <message>` and the others keep running; the process exits `1` and also writes the `CHECK_FAILED` envelope to stderr.
