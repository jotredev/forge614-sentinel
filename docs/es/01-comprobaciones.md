# 01 — Comprobaciones

> Como la lista de revisión de un inspector: cada punto tiene un número, un criterio y una casilla.

## Cómo se elige qué corre

El pack del reglamento (`packs/forge614-pack-ecosystem-node/pack.json`) nombra reglas; cada regla puede declarar un `validator` en su `manifest.json`. Sentinel corre las comprobaciones que esos validadores nombran (con un mapa de nombres antiguos: `bilingual-docs` → `docs-parity`, `decision-records` → `decisions`) más las comprobaciones nativas que el estándar 1.0.0 todavía no nombra (el estándar 1.1.0 las nombra explícitamente). Si el pack pide un validador que esta versión de Sentinel no implementa, aparece una entrada `caution` con `SENTINEL_OUTDATED` en la evidencia: nunca se omite en silencio. `--only <id,id>` limita la ejecución; un id desconocido es `INVALID_ARGUMENTS`.

Cada comprobación declara cuándo aplica (`appliesWhen`); si no aplica, la entrada dice `not-applicable` con el motivo y no cuenta para el veredicto global. Ninguna comprobación devuelve `pass` por no saber.

## Las 11 trasladadas

Vienen de los validadores de `forge614-ai` con las mismas evidencias:

| Id | Qué comprueba |
| --- | --- |
| `package-naming` | carpetas de `standard/rules`, `standard/packs` y paquetes del Hub bajo `.agents/` con nombre `origen-tipo-nombre` |
| `forbidden-mentions` | ningún término de `forbidden-mentions.json` del reglamento en el árbol (salvo rutas excluidas) |
| `docs-parity` | pares `README`, `CONTRACT`, `docs/es/NN-*`/`docs/en/NN-*` con el mismo número de encabezados y la misma numeración |
| `decisions` | actas numeradas sin huecos, estados válidos, secciones obligatorias e `INDEX.json` coherente |
| `agent-checklist-impact` | todo plan cerrado en `.agents/plans/` declara `Sí`/`No` y explica el impacto en el procedimiento de agentes |
| `error-codes` | códigos de `CONTRACT.md` y de `printError(...)` en `MAYUSCULAS_CON_GUION_BAJO` |
| `support-matrix` | `standard/support-matrix.json` válido y sin celdas en revalidación vencidas (solo `forge614-ai`) |
| `workflows` | workflows delgados: `bun run <script>` existente, acciones fijadas por SHA, `timeout-minutes`, jobs documentados |
| `context-budget` | la suma estimada del índice del pack no supera 3000 tokens (solo `forge614-ai`) |
| `ecosystem-contract` | una copia local de `FORGE614_ECOSYSTEM_CONTRACT.md`, si existe, es idéntica a la publicada |
| `rules-catalog` | manifiestos de reglas y `pack.json` válidos, carpetas con su nombre, validadores conocidos (solo `forge614-ai`) |

## Las 8 nuevas

| Id | Qué comprueba | De dónde salen los parámetros |
| --- | --- | --- |
| `node-pointer` | `forge614.node.json` válido y `standard.sha256` igual a la huella del paquete en caché de esa versión | caché |
| `layout` | carpetas y archivos obligatorios de STANDARD §2; nada en `scripts/` que duplique una plantilla | lista incorporada en Sentinel con 1.0.0 (evidencia `source: builtin`); `layout.json` en 1.1.0 (la evidencia dice cuál) |
| `stack` | `tsconfig.json` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; `any` en posición de tipo y directivas `@ts-ignore`/`@ts-expect-error` prohibidas en `src/` (tests excluidos; comentarios, textos y expresiones regulares no cuentan); `bun.lock`; `engines.bun` ≥ 1.3.9 | lista incorporada en Sentinel con 1.0.0 (`source: builtin`); `stack.json` en 1.1.0 |
| `secrets-hygiene` | patrones de secretos (claves privadas, tokens con prefijo conocido, cadenas de conexión con credenciales) y `.env` con valores reales; solo reporta el patrón y la línea, nunca el valor | lista incorporada en Sentinel con 1.0.0 (`source: builtin`); `secret-patterns.json` en 1.1.0 |
| `node-contract` | `CONTRACT.md` y `CONTRACT.en.md` con las mismas filas; en las dos direcciones: cada `bun run <script>` de la tabla existe en `package.json` y cada script que invocan las plantillas `verify.yml` y `release.yml` aparece en la tabla; cada código de la tabla aparece en `src/interfaces/cli` y cada código de la CLI está en la tabla | plantillas del reglamento (qué scripts son públicos) |
| `installer` | `install.sh` e `install.ps1` idénticos a la plantilla renderizada con las variables del nodo; la versión del reglamento es la que declara `forge614.node.json`, también en una revisión forzada con `--standard` (`forge614-ai` exento) | plantillas del reglamento |
| `release` | `verify.yml` y `release.yml` con los jobs de la plantilla intactos, acciones fijadas por SHA, `CHANGELOG.md` presente; solo se admiten jobs añadidos de una lista explícita (`parity`) | plantillas del reglamento; lista de jobs añadidos incorporada en Sentinel |
| `versions` | igualdad exacta entre `package.json.version`, `docs/notion-map.json.productVersion` y, cuando el checkout tiene tags `v*`, el más alto | — |

## Veredictos y evidencias

`pass` sin problemas (puede llevar evidencia informativa, por ejemplo qué lista incorporada se usó); `caution` cuando Sentinel no puede afirmar ni negar (huella no cruzable en una revisión forzada, validador desconocido); `fail` con evidencia concreta (`ruta:línea: motivo`); `not-applicable` con motivo. Una comprobación que lanza una excepción se reporta como `fail` con `CHECK_FAILED: <mensaje>` y las demás siguen; el proceso sale `1` y además escribe el sobre `CHECK_FAILED` en stderr.
