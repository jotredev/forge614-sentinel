# 03 — Integración

> Como el sello de inspección en la entrada de un local: sin él, no abre.

## En el verify de cada nodo

El script `verify` del nodo corre, además de lo suyo, `forge614-sentinel check --json` y falla si el veredicto es `fail`. Si el binario no está instalado, `verify` falla con `SENTINEL_NOT_INSTALLED` y el comando de instalación; no avisa y sigue. Ese cambio en el `verify` de cada nodo no forma parte de Sentinel 0.1: lo hacen el Plan A2 en `forge614-ai` y la fase 0.4 en los demás nodos. Sentinel es obligatorio para desarrollar nodos del ecosistema y opcional para productos de terceros hechos con el ecosistema (que reciben `applicable: false`).

## En CI

La plantilla `verify.yml` del estándar 1.1.0 (Plan A2) añade un paso `bun run sentinel:install` antes de `bun run verify`: descarga la release de Sentinel fijada en `forge614.node.json` (`sentinel.version`, campo opcional nuevo) para la plataforma del runner y verifica `SHA256SUMS`. Las releases son públicas: sin token no hay escritura. Este repositorio no se instala a sí mismo: su `verify` corre `check` desde el código fuente (`bun run sentinel:check`) contra la copia del reglamento en `fixtures/standard/`, cuya huella es la que fija `forge614.node.json`.

## Códigos de salida y errores

`0` con `pass`, con `caution` (salvo `--strict`) y con `applicable: false`; `1` con `fail`, con `caution` bajo `--strict` y con `STANDARD_UNAVAILABLE`, `STANDARD_CORRUPT`, `STANDARD_FETCH_FAILED`, `CHECK_FAILED` o `SENTINEL_FAILED`; `2` con `INVALID_ARGUMENTS` y `NODE_POINTER_INVALID`. Los sobres de error nunca incluyen rutas absolutas ni stack traces.

## Arranque circular con forge614-ai

`forge614-ai` publicó el reglamento 1.0.0; Sentinel se construyó desde sus plantillas y se revisa a sí mismo; una vez publicado Sentinel 0.1, `forge614-ai` adopta `check` en su `verify`, retira sus validadores y publica el estándar 1.1.0 (plantilla `verify.yml` con Sentinel, `layout.json`, `stack.json`, `secret-patterns.json`). Los demás nodos adoptan Sentinel en su siguiente release (fase 0.4). Un nodo puede declarar 1.0.0 mientras Sentinel ya conoce 1.1.0: se revisa con la versión declarada.
