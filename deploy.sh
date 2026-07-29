#!/usr/bin/env bash
# RETIRADO (E0g-3, ADR-0028). Este script era una segunda ruta de despliegue no
# gobernada: hacía `git add .` + commit + push automáticos y pull+build+up en
# el VPS, saltándose SHA explícito, aprobación, validate:egress y rollback
# versionado — la misma clase de mecanismo que causó el incidente E0 del
# 2026-07-28. Se conserva como shim fail-closed para que cualquier alias o
# automatización olvidada falle de forma explícita, no silenciosa.
set -euo pipefail

echo "ERROR: deploy.sh legacy está deshabilitado (E0g-3, ADR-0028)." >&2
echo "El único despliegue autorizado es el workflow manual 'Deploy PixelTEC OS (manual)'" >&2
echo "con SHA completo, aprobación del Environment 'production' y credencial de deploy dedicada." >&2
echo "Detalle: scripts/deploy/production-deploy.sh y README (Operaciones comunes)." >&2
exit 1
