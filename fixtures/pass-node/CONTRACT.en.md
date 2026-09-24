# Contract of Demo (`forge614-demo`)

> One-sentence analogy: <fill in>.

## Purpose
One sentence.

## What it does
- …

## What it does not do
- …

## Dependencies
| Node or binary | How it is consumed | Minimum version |
| --- | --- | --- |

## Public commands
| Command | Input (schema) | Output (schema) | `schemaVersion` | Exit codes |
| --- | --- | --- | --- | --- |
| `bun run verify` | none | `{ ok }` | `1` | `0`; `1` `DEMO_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run build:target`, `bun run smoke:target`, `bun run release:publish` | `FORGE614_TARGET` | `{ ok }` | `1` | `0`; `1` `DEMO_FAILED` |

## Error codes
| Code | Meaning |
| --- | --- |
| `INVALID_ARGUMENTS` | Unsupported argument |
| `DEMO_FAILED` | Unexpected error |

## Mandatory requirements for supported AI assistants
`demo` section of `standard/procedures/new-agent-checklist.md` (standard 1.0.0).

## Compatibility
Breaking changes bump `schemaVersion`; one compatibility version is kept.
