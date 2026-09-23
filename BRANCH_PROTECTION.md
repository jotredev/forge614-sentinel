# Protección de la rama `main`

Configuración exacta que debe tener el repositorio (Settings → Rules → Rulesets, o Branch protection):

| Ajuste | Valor |
| --- | --- |
| Rama protegida | `main` |
| Requiere pull request antes de fusionar | Sí; 1 aprobación mínima cuando hay más de un mantenedor; 0 cuando hay uno solo (GitHub no permite aprobar el propio PR); descartar aprobaciones obsoletas |
| Status checks requeridos | `verify` (workflow `verify.yml`), actualizado con la base |
| Push directo a `main` | Prohibido para todos, incluidos administradores |
| Force push y borrado de `main` | Prohibidos |
| Historial lineal | Requerido |
| Firmas de commit | Recomendado |

Además, cada persona instala el gancho local: `git config core.hooksPath .githooks`.
