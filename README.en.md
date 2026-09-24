# Forge614 Sentinel (`forge614-sentinel`)

> One-sentence analogy: like a municipal inspector, it arrives with the current code, inspects the building, hands over the report and leaves; it does not build or repair.

## What it is
The verifier of the Forge614 ecosystem: it checks a repository against the Node Standard it declares and returns a report with a verdict and evidence.

## What it is not
- It does not fix or write to the repository it checks.
- It does not choose the standard on its own: it uses the version the repository declares.
- It does not check third-party projects or run the node.

## Installation

macOS / Linux:
```bash
curl -fsSL https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.sh | bash
```

Windows (PowerShell):
```powershell
irm https://github.com/jotredev/forge614-sentinel/releases/latest/download/install.ps1 | iex
```

## Documentation
| # | Español | English |
| --- | --- | --- |
| 00 | [Resumen y guía rápida](docs/es/00-resumen-y-guia-rapida.md) | [Summary and quickstart](docs/en/00-summary-and-quickstart.md) |
| 01 | [Comprobaciones](docs/es/01-comprobaciones.md) | [Checks](docs/en/01-checks.md) |
| 02 | [Reglamento y caché](docs/es/02-reglamento-y-cache.md) | [Standard and cache](docs/en/02-standard-and-cache.md) |
| 03 | [Integración](docs/es/03-integracion.md) | [Integration](docs/en/03-integration.md) |
| 04 | [Workflows](docs/es/04-workflows.md) | [Workflows](docs/en/04-workflows.md) |
| — | [Contrato](CONTRACT.md) | [Contract](CONTRACT.en.md) |

## Contract
See [`CONTRACT.md`](CONTRACT.md) (standard 1.0.2).
