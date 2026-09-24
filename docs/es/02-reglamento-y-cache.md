# 02 — Reglamento y caché

> Como la copia sellada del reglamento en el archivo municipal: se comprueba el sello antes de usarla y nunca se corrige a mano.

## De dónde sale el reglamento

De la release `standard-v<versión>` de `jotredev/forge614-ai`: `standard-<versión>.tar.gz` y `SHA256SUMS`. El origen es un dato (`{ kind: "github-release", repository, version, sha256 }`); en 0.1 el repositorio es fijo y solo la versión y la huella vienen del repositorio revisado (`forge614.node.json`, campos `standard.version` y `standard.sha256`). `--standard <versión>` fuerza otra versión y el informe lo marca con `forced: true`. Sentinel nunca elige "la más nueva".

## La caché local

`<FORGE614_HOME o ~/.forge614>/standard/<versión>/` con `manifest.json` (`{ schemaVersion: 1, version, sha256, fetchedAt }`) y `content/` (el paquete extraído). La escritura es atómica: se extrae en una carpeta temporal y se renombra; nunca hay una entrada a medias. `forge614-sentinel standard fetch [<versión>]` la llena a mano; `check` la llena sola la primera vez que falta la versión pedida.

## Verificación de huellas

Antes de aceptar un paquete se compara su sha256 con el de `SHA256SUMS` y con el que declara el repositorio revisado; si difieren, `STANDARD_CORRUPT` y no se guarda nada. Al cargar de caché se vuelve a comparar `manifest.sha256` con la huella declarada. Por eso, si la huella del puntero no coincide con la de la release o con la de la caché (el puntero se editó a mano o la release cambió), el resultado es `STANDARD_CORRUPT` antes de correr ninguna comprobación: no hay informe, solo el sobre de error. La comprobación `node-pointer` cubre el caso que queda, una revisión forzada con `--standard`: cruza `standard.sha256` del repositorio con la huella en caché de la versión que el puntero declara y da `fail` si difieren, o `caution` si esa versión no está en caché.

## Sin red

Con la versión pedida en caché, `check` no usa red. Sin caché y sin red, `STANDARD_UNAVAILABLE` con el comando para obtenerlo; nunca se revisa con otra versión "por aproximación". Si hay una versión más nueva en caché que la que el nodo declara, el informe la anota en `standard.latestKnown` sin usarla. Dos variables de entorno existen solo para pruebas y CI sin red: `FORGE614_SENTINEL_RELEASE_BASE` (una URL `file://` con la misma estructura que la release) y `FORGE614_SENTINEL_OFFLINE=1`.
