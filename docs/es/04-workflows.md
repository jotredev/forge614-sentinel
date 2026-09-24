# 04 — Workflows de integración y release

> Como la lista de control de un vuelo: cada paso está escrito, se ejecuta igual en tierra (local) que en el aire (CI), y nadie despega sin completarla.

## `verify.yml`
| Job | Disparador | Qué ejecuta | Qué valida | Duración esperada |
| --- | --- | --- | --- | --- |
| `verify` | push a `main`, pull request | `bun install --frozen-lockfile`, `bun run verify` | typecheck, tests (unitarios y e2e con el binario compilado), `workflows:check`, `notion-map:build --check`, `sentinel:check` sobre este repositorio | ~3 min |
| `parity` | push a `main`, pull request | `bun install --frozen-lockfile`, `bun run sentinel:parity` en `ubuntu-24.04`, `macos-15` y `windows-2025` | que el informe de `check` sobre `fixtures/pass-node` y `fixtures/fail-node` (sin `durationMs`) sea byte a byte el de `fixtures/golden/` en los tres sistemas | ~2 min por sistema |

## `release.yml`
| Job | Disparador | Qué ejecuta | Qué publica | Duración esperada |
| --- | --- | --- | --- | --- |
| `build` | tag `v*` | `bun run build:target`, `bun run smoke:target` en macOS arm64/x64, Linux arm64/x64, Windows x64 | artefactos por plataforma | ~8 min |
| `publish` | tras `build` | `bun run release:publish` | release con binarios y `SHA256SUMS` | ~1 min |

Todo job declara `timeout-minutes` (`verify`: 10; `parity`: 15; `build`: 20; `publish`: 10): ninguna etapa queda sin límite y `bun run workflows:check` rechaza el job que no lo lleva.

**Precondición de `release.yml`:** un nodo con dependencias `file:../` a repositorios hermanos en su `package.json` no puede adoptar esta plantilla; el workflow hace checkout de un solo repositorio y `bun install --frozen-lockfile` fallaría contra esa dependencia de ruta. Se sustituye por la versión publicada del nodo hermano antes de adoptar la plantilla.

## Ejecutar en local
`bun run workflows:run --workflow verify` ejecuta, en orden, los mismos scripts que el job `verify`. El gancho `pre-push` lo hace automáticamente.

## Acciones fijadas
| Acción | Versión | SHA |
| --- | --- | --- |
| actions/checkout | v4.3.1 | 34e114876b0b11c390a56381ad16ebd13914f8d5 |
| oven-sh/setup-bun | v2.0.2 | 735343b667d3e6f658f44d0eca948eb6282f2b76 |
| actions/upload-artifact | v4.6.2 | ea165f8d65b6e75b540449e92b4886f43607fa02 |
| actions/download-artifact | v4.3.0 | d3f86a106a0bac45b974a628896c90dbdf5c8093 |
