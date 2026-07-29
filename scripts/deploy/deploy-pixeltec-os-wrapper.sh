#!/usr/bin/env bash
# Wrapper canónico del deploy manual de PixelTEC OS (M1A).
#
# PLANTILLA VERSIONADA Y AUDITADA. En el VPS se instala (gate M1B, comando
# explícito) como:
#   /usr/local/sbin/deploy-pixeltec-os        (root:root, modo 0755)
# root POSEE el archivo (integridad: ubuntu no puede modificarlo en silencio);
# se EJECUTA como ubuntu, sin sudo — mínimo privilegio: el motor no se eleva.
#
# Uso:
#   deploy-pixeltec-os --sha <40-hex> \
#     [--require-r2-delete] [--require-meta-credential-read] \
#     [--require-meta-publish] [--check-only]
#
# Flujo: valida argumentos → exige usuario operativo → lock exclusivo (flock,
# liberado al salir incluso en fallo) → git fetch → SHA existente y ancestro de
# origin/main → extrae el motor production-deploy.sh DEL SHA aprobado → bash -n
# → lo ejecuta con evidencia en /home/ubuntu/deploy-logs/ (permisos privados).
# No usa: GITHUB_*, sudo, set -x, git pull/checkout/switch/reset.
#
# Las variables DEPLOY_* de entorno existen únicamente para las pruebas
# estáticas del repo; en el VPS no se definen y aplican los valores canónicos.
set -euo pipefail

EXPECTED_USER="${DEPLOY_EXPECTED_USER:-ubuntu}"
APP_DIR="${DEPLOY_APP_DIR:-/home/ubuntu/pixeltec-os}"
LOG_DIR="${DEPLOY_LOG_DIR:-/home/ubuntu/deploy-logs}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/home/ubuntu/.pixeltec-os-deploy.lock}"

fail() { echo "DEPLOY-WRAPPER FAIL: $1" >&2; exit 1; }

SHA=""
ARGS=()
CHECK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --sha)
      [ $# -ge 2 ] || fail "--sha requiere valor"
      SHA="$2"; shift 2 ;;
    --require-r2-delete|--require-meta-credential-read|--require-meta-publish)
      ARGS+=("$1"); shift ;;
    --check-only)
      CHECK_ONLY=1; ARGS+=("$1"); shift ;;
    *)
      fail "argumento desconocido: $1" ;;
  esac
done

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "--sha debe ser un SHA hexadecimal completo (40)"
[ "$(id -un)" = "$EXPECTED_USER" ] || fail "debe ejecutarse como el usuario operativo '$EXPECTED_USER'"

# Lock exclusivo: un único deploy/check activo. El fd 9 se libera al salir del
# proceso (éxito, fallo o kill) — sin depender de pgrep ni de limpieza manual.
exec 9>"$LOCK_FILE"
flock -n 9 || fail "otro deploy o check está en curso (lock: $LOCK_FILE)"

[ -d "$APP_DIR/.git" ] || fail "no existe el repositorio en $APP_DIR"
git -C "$APP_DIR" fetch origin --quiet || fail "git fetch origin falló"
git -C "$APP_DIR" cat-file -e "$SHA^{commit}" 2>/dev/null || fail "el SHA no existe en origin"
git -C "$APP_DIR" merge-base --is-ancestor "$SHA" origin/main \
  || fail "el SHA no es ancestro de origin/main"

umask 077
mkdir -p "$LOG_DIR"
MODE=deploy
[ "$CHECK_ONLY" = 1 ] && MODE=check
LOG_FILE="$LOG_DIR/pixeltec-os-$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}-$MODE.log"

# El motor se extrae DEL SHA aprobado — nunca del checkout mutable.
ENGINE="$(mktemp)"
trap 'rm -f "$ENGINE"' EXIT
git -C "$APP_DIR" show "$SHA:scripts/deploy/production-deploy.sh" > "$ENGINE" \
  || fail "el SHA no contiene scripts/deploy/production-deploy.sh"
bash -n "$ENGINE" || fail "el motor extraído del SHA no pasa bash -n"

set +e
{
  echo "== deploy-pixeltec-os sha=$SHA mode=$MODE caps=${ARGS[*]:-ninguna} user=$(id -un) utc=$(date -u +%FT%TZ) =="
  bash "$ENGINE" "$SHA" ${ARGS[@]:+"${ARGS[@]}"}
} 2>&1 | tee "$LOG_FILE"
RC=$?
set -e
echo "== resultado rc=$RC mode=$MODE log=$LOG_FILE ==" | tee -a "$LOG_FILE"
exit "$RC"
