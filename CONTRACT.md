# Contrato de Forge614 Sentinel (`forge614-sentinel`)

> Analogía en una frase: como un inspector municipal, llega con el reglamento vigente, revisa, entrega el acta y se va; no construye ni repara.

## Propósito
Revisar cualquier repositorio del ecosistema contra el Estándar de Nodo que declara y entregar un informe con veredicto y evidencias, igual en Linux, macOS y Windows.

## Qué hace
- Clasifica el repositorio por archivos de identidad (`forge614.node.json`, `.forge614/project.json`) y revisa solo nodos del ecosistema.
- Obtiene, verifica (sha256) y cachea el reglamento que el nodo declara; nunca elige otra versión por su cuenta.
- Ejecuta las 19 comprobaciones de Sentinel 0.1 (documento 01) seleccionadas por el pack del reglamento y produce `CheckReport` (`schemaVersion: 1`).
- Se revisa a sí mismo en `verify` y prueba la paridad del informe en tres sistemas.

## Qué no hace
- No escribe en el repositorio revisado ni corrige nada.
- No usa red durante las comprobaciones; solo para descargar el reglamento que falta en caché.
- No revisa proyectos de terceros ni reglamentos de terceros (entregas futuras); no ejecuta el nodo (`import-rules`, `boundaries-zod`, `machine-contracts` llegan en 0.2).

## Dependencias
| Nodo o binario | Cómo se consume | Versión mínima |
| --- | --- | --- |
| Bun | runtime de desarrollo y `bun build --compile`; fijado en los workflows (acta 0026) | 1.4.2 (CI); `engines.bun >= 1.3.9` |
| TypeScript | `devDependency`; `bun run typecheck` | 5.9.3 |
| zod | esquemas en toda frontera | 4.6.5 |
| fflate | `gunzipSync` para el reglamento; `gzipSync`/`zipSync` para los artefactos de release | 0.8.3 |
| yaml | lectura de workflows | 2.8.1 |
| git | solo lectura (`ls-files`, `tag`, `log`), opcional: sin git se recorre el disco | cualquiera |
| gh | solo en `release:publish` (runner de GitHub) | 2.x |
| forge614-ai | release `standard-v<versión>` (paquete + `SHA256SUMS`) | 1.0.0 |

## Comandos públicos
| Comando | Entrada (esquema) | Salida (esquema) | `schemaVersion` | Códigos de salida |
| --- | --- | --- | --- | --- |
| `forge614-sentinel check` | `[--repo <ruta>] [--standard <X.Y.Z>] [--only <id,id>] [--strict] [--json]` | `CheckReport` o `{ applicable: false, reason }` | `1` | `0` pass, caution, no aplicable; `1` fail, caution con `--strict`, `STANDARD_UNAVAILABLE`, `STANDARD_CORRUPT`, `STANDARD_FETCH_FAILED`, `CHECK_FAILED`, `SENTINEL_FAILED`; `2` `INVALID_ARGUMENTS`, `NODE_POINTER_INVALID` |
| `forge614-sentinel standard fetch` | `[<X.Y.Z>] [--json]` (sin versión usa `./forge614.node.json`) | `{ version, sha256, alreadyCached, location }` | `1` | `0`; `1` `STANDARD_FETCH_FAILED`, `STANDARD_CORRUPT`, `SENTINEL_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run verify` | `[--skip-tests]` | `{ ok: true, steps, sentinel: { verdict, durationMs } }` | `1` | `0`; `1` `VERIFY_STEP_FAILED`, `VERIFY_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run sentinel:check` | ninguna (alias de `check --repo . --json`) | `CheckReport` | `1` | los de `check` |
| `bun run sentinel:parity` | `[--update]` | `{ ok: true, compared }` | `1` | `0`; `1` `PARITY_MISMATCH`, `PARITY_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run workflows:check` | ninguna | `{ verdict, evidence }` | `1` | `0` pass; `1` en otro caso o `WORKFLOWS_CHECK_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run workflows:run` | `[--workflow <nombre>]` | `{ workflow, jobs, ok }` | `1` | `0`; `1` paso fallido, `WORKFLOW_NOT_FOUND`, `WORKFLOWS_RUN_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run notion-map:build` | `[--check]` | `{ path, pages }` o `{ ok: true, path }` | `1` | `0`; `1` `NOTION_MAP_DRIFT`, `NOTION_MAP_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run build:target` | `[--target <t>]` o `FORGE614_TARGET` | `{ target, binary, archive, sha256 }` | `1` | `0`; `1` `BUILD_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run smoke:target` | `[--target <t>]` o `FORGE614_TARGET` | `{ target, version, steps }` | `1` | `0`; `1` `SMOKE_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run release:publish` | `[--tag vX.Y.Z] [--dry-run]` (sin `--tag` usa `GITHUB_REF_NAME`) | `{ tag, version, assets, command, published }` | `1` | `0`; `1` `RELEASE_TAG_MISMATCH`, `RELEASE_ASSETS_MISSING`, `RELEASE_PUBLISH_FAILED`; `2` `INVALID_ARGUMENTS` |

Toda salida de datos es un solo objeto JSON en stdout con `schemaVersion: 1`; todo error es `{ schemaVersion: 1, code, error }` en stderr sin rutas absolutas; ningún comando imprime un stack trace. Todos aceptan `--help` (imprime `{ usage }`) y `--version` (`{ name: "forge614-sentinel", version }`) antes de analizar cualquier otro argumento. Variables de entorno: `FORGE614_HOME` (raíz de la caché), y solo para pruebas y CI sin red, `FORGE614_SENTINEL_RELEASE_BASE`, `FORGE614_SENTINEL_OFFLINE`, `FORGE614_SENTINEL_CRASH_CHECK`.

## Códigos de error
| Código | Significado |
| --- | --- |
| `INVALID_ARGUMENTS` | flag desconocido, valor inválido, `--only` con id inexistente, argumento posicional inesperado; salida `2` |
| `NODE_POINTER_INVALID` | `forge614.node.json` no cumple `NodePointerSchema`; salida `2` |
| `STANDARD_UNAVAILABLE` | la versión declarada no está en caché y no hay red; el mensaje trae el comando `standard fetch` |
| `STANDARD_CORRUPT` | la huella del paquete (descargado o en caché) no coincide con la pedida o con `SHA256SUMS`; no se guarda nada |
| `STANDARD_FETCH_FAILED` | error de red o de release al descargar el reglamento |
| `CHECK_FAILED` | una comprobación lanzó una excepción; el informe completo se imprime igualmente con veredicto `fail` |
| `SENTINEL_FAILED` | error inesperado fuera de las comprobaciones |
| `VERIFY_STEP_FAILED` | un paso de `verify` terminó con salida distinta de `0` o `sentinel:check` no dio `pass` |
| `VERIFY_FAILED` | `verify`: error inesperado |
| `WORKFLOWS_CHECK_FAILED` | `workflows:check`: error inesperado |
| `WORKFLOWS_RUN_FAILED` | `workflows:run`: error inesperado |
| `WORKFLOW_NOT_FOUND` | `workflows:run`: el workflow pedido no existe o no cumple `WorkflowSchema` |
| `NOTION_MAP_DRIFT` | `notion-map:build --check`: `docs/notion-map.json` no coincide con el mapa fresco |
| `NOTION_MAP_FAILED` | `notion-map:build`: error inesperado |
| `PARITY_MISMATCH` | `sentinel:parity`: el informe de una fixture difiere del golden |
| `PARITY_FAILED` | `sentinel:parity`: error inesperado |
| `BUILD_FAILED` | `build:target`: `bun build --compile` falló |
| `SMOKE_FAILED` | `smoke:target`: el binario no responde `--version`/`--help` o `check` sobre la fixture no da `pass` |
| `RELEASE_TAG_MISMATCH` | `release:publish`: el tag no es `v<package.json.version>` |
| `RELEASE_ASSETS_MISSING` | `release:publish`: falta alguno de los cinco artefactos |
| `RELEASE_PUBLISH_FAILED` | `release:publish`: `gh` no pudo ejecutarse o la release no se creó |

## Requisitos obligatorios para asistentes de IA soportados
Sección `sentinel` de `standard/procedures/new-agent-checklist.md` (estándar 1.0.0): no existe porque Sentinel no integra asistentes de IA; los asistentes consumen su informe JSON como cualquier otra herramienta.

## Compatibilidad
Cambios incompatibles suben `schemaVersion`; se mantiene una versión de compatibilidad. `CheckReport` evoluciona de forma aditiva (acta 0024): campos nuevos opcionales, nunca renombrar ni quitar.
