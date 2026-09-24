# Contrato de Demo (`forge614-demo`)

> Analogía en una frase: <completar>.

## Propósito
Una frase.

## Qué hace
- …

## Qué no hace
- …

## Dependencias
| Nodo o binario | Cómo se consume | Versión mínima |
| --- | --- | --- |

## Comandos públicos
| Comando | Entrada (esquema) | Salida (esquema) | `schemaVersion` | Códigos de salida |
| --- | --- | --- | --- | --- |
| `bun run verify` | ninguna | `{ ok }` | `1` | `0`; `1` `DEMO_FAILED`; `2` `INVALID_ARGUMENTS` |
| `bun run build:target`, `bun run smoke:target`, `bun run release:publish` | `FORGE614_TARGET` | `{ ok }` | `1` | `0`; `1` `DEMO_FAILED` |

## Códigos de error
| Código | Significado |
| --- | --- |
| `INVALID_ARGUMENTS` | Argumento no admitido |
| `DEMO_FAILED` | Error inesperado |

## Requisitos obligatorios para asistentes de IA soportados
Sección `demo` de `standard/procedures/new-agent-checklist.md` (estándar 1.0.0).

## Compatibilidad
Cambios incompatibles suben `schemaVersion`; se mantiene una versión de compatibilidad.
