#!/usr/bin/env bash
# RETIRADO (E0g-3, ADR-0028; actualizado en M1A). Este script era una segunda
# ruta de despliegue no gobernada: hacía `git add .` + commit + push automáticos
# y pull+build+up en el VPS — la clase de mecanismo que causó el incidente E0
# del 2026-07-28. Se conserva como shim fail-closed para que cualquier alias o
# automatización olvidada falle de forma explícita, no silenciosa.
# Cero Git, Docker, red o secretos aquí dentro.
set -euo pipefail

echo "ERROR: deploy.sh legacy está deshabilitado (E0g-3, ADR-0028; M1A)." >&2
echo "GitHub Actions YA NO despliega producción (el workflow fue eliminado)." >&2
echo "El ÚNICO camino autorizado es el comando manual gobernado en el VPS:" >&2
echo "  /usr/local/sbin/deploy-pixeltec-os --sha <40-hex> [--require-*] [--check-only]" >&2
echo "Motor versionado: scripts/deploy/production-deploy.sh. Detalle: README, 'Operaciones comunes'." >&2
exit 1
