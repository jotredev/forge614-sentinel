# 00 — Resumen y guía rápida

> Como un inspector municipal: llega con el reglamento vigente bajo el brazo, revisa el edificio, entrega un acta con lo que cumple y lo que no, y se va. No construye, no repara, no decide qué hacer con el acta.

## Qué es forge614-sentinel

`forge614-sentinel` es el verificador del ecosistema Forge614. Revisa un repositorio contra el Estándar de Nodo que ese repositorio declara en `forge614.node.json` y entrega un informe con un veredicto por comprobación (`pass`, `caution`, `fail`, `not-applicable`) y uno global. Sentinel **juzga, nunca hace**: no escribe en el repositorio revisado, no corrige nada y no elige el reglamento por su cuenta.

Decide qué hacer solo por archivos de identidad (acta 0023): con `forge614.node.json` válido revisa; con `.forge614/project.json` responde `applicable: false, reason: "external-project"`; sin ninguno, `not-a-forge614-repo`. Nunca por el nombre de la carpeta ni por los remotos de Git.

## Instalar y ejecutar en un minuto

macOS / Linux: `curl -fsSL https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.sh | bash`. Windows: `irm https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.ps1 | iex`. El instalador deja el binario en `~/.forge614/sentinel/<versión>/` y el lanzador en `~/.forge614/sentinel/bin/forge614-sentinel`; comprueba la huella publicada en `SHA256SUMS` antes de instalar.

En la raíz de un nodo: `forge614-sentinel check --json`. La primera vez descarga el reglamento declarado (documento 02); las siguientes no usan red. Código de salida `0` con `pass` o `caution`, `1` con `fail`, `2` con argumentos inválidos.

## Qué sale en el informe

Un solo objeto JSON en stdout con `schemaVersion: 1`: la versión de Sentinel, el reglamento usado (versión, huella, si fue forzado con `--standard`, si se descargó en esta ejecución y, cuando existe, `latestKnown`), el repositorio (`kind: "node"`, `name`), el veredicto global (el peor de las comprobaciones aplicadas), la lista de comprobaciones con `id`, `verdict`, `applied`, `evidence` y `message` en español e inglés, y `durationMs`. Los errores van a stderr como `{ schemaVersion, code, error }`; los códigos están en `CONTRACT.md`.

## Dónde seguir leyendo

- Documento 01: las 19 comprobaciones y cómo se elige cuáles corren.
- Documento 02: de dónde sale el reglamento, la caché y las huellas.
- Documento 03: cómo se integra en el `verify` de cada nodo y en CI.
- Documento 04: los workflows de este repositorio.
- `CONTRACT.md`: comandos, salidas y códigos de error.
