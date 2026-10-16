# 03 — Integración

> Como el sello de inspección en la entrada de un local: sin él, no abre.

## Instalar, actualizar y desinstalar

En macOS y Linux se instala con `curl -fsSL https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.sh | bash`; en Windows PowerShell, con `irm https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.ps1 | iex`. Se requiere Node.js 22.19.0 o posterior. `forge614-sentinel update` y `forge614-sentinel uninstall` usan el portero de la release más reciente; `forge614-sentinel uninstall --self` responde sin cambios porque Sentinel no integra asistentes.

## En el verify de cada nodo

El script `verify` del nodo corre, además de lo suyo, `forge614-sentinel check --json` y falla si el veredicto es `fail`. Si el binario no está instalado, `verify` falla con `SENTINEL_NOT_INSTALLED` y el comando de instalación; no avisa y sigue. Ese cambio en el `verify` de cada nodo no forma parte de Sentinel 0.1: lo hacen el Plan A2 en `forge614-ai` y la fase 0.4 en los demás nodos. Sentinel es obligatorio para desarrollar nodos del ecosistema y opcional para productos de terceros hechos con el ecosistema (que reciben `applicable: false`).

## En CI

Las releases son públicas: instalar Sentinel no requiere un token de GitHub. Este repositorio se comprueba desde el código fuente y usa `fixtures/standard/standard-v1.2.1/` para que `verify` funcione sin red. La ficha `forge614.node.json` fija la versión y la huella del reglamento; el instalador no elige otra versión por su cuenta.

## Códigos de salida y errores

`0` con `pass`, con `caution` (salvo `--strict`) y con `applicable: false`; `1` con `fail`, con `caution` bajo `--strict` y con errores de comprobación, `UPDATE_FAILED` o `UNINSTALL_FAILED`; `2` con argumentos o ficha inválidos; `130` si se cancela `uninstall`. Los sobres de error nunca incluyen rutas absolutas ni stack traces.

## Arranque circular con forge614-ai

El reglamento 1.2.1 define el instalador común. Sentinel 0.2.1 es el primer nodo que lo adopta: sus dos porteros verifican el `install.mjs` compartido y la ficha antes de ejecutarlo. Los nodos restantes lo adoptan en el orden acordado por el ecosistema; Sentinel acepta tanto las fichas de nodos con la plantilla anterior como las de la nueva.
