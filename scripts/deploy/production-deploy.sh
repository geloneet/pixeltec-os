#!/usr/bin/env bash
# Deploy de producción de PixelTEC OS — pipeline endurecido (E0g-3, ADR-0028).
#
# Corre EN el VPS. El workflow manual lo extrae DEL SHA solicitado
# (`git show <sha>:scripts/deploy/production-deploy.sh`) y lo entrega por stdin:
#   ssh <user>@<vps> 'bash -s -- <sha40> [--require-r2-delete] \
#     [--require-meta-credential-read] [--require-meta-publish]' < script
#
# Garantías:
#   - SHA hexadecimal completo, existente y ancestro de origin/main.
#   - Checkout DETACHED del SHA — jamás `git pull` ni ramas mutables.
#   - `validate:egress --profile=predeploy` ANTES de build/restart; capabilities
#     solo las aprobadas por inputs (mínimo privilegio).
#   - Imagen etiquetada por SHA (pixeltec-os-app:<sha>); `latest` solo se mueve
#     tras health OK. Sin `docker image prune`: se conservan como mínimo la
#     imagen activa y la anterior (la limpieza es un gate separado).
#   - Recrea EXCLUSIVAMENTE el servicio `app`; rollback automático ante health
#     FAIL usando la versión previa registrada en .deploy-active-sha.
#   - Nunca imprime valores del entorno; prohibido `set -x`.
set -euo pipefail

APP_DIR=/home/ubuntu/pixeltec-os
IMAGE=pixeltec-os-app
ACTIVE_SHA_FILE="$APP_DIR/.deploy-active-sha"
HOST_HEADER=pixeltec.mx

fail() { echo "DEPLOY FAIL: $1" >&2; exit 1; }

SHA="${1:-}"
shift || true
CAPS=()
for c in "$@"; do
  case "$c" in
    --require-r2-delete|--require-meta-credential-read|--require-meta-publish)
      CAPS+=("$c") ;;
    *) fail "capability desconocida: $c" ;;
  esac
done

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "commit_sha debe ser un SHA hexadecimal completo (40)"
cd "$APP_DIR"
[ -f .env.production ] || fail "falta .env.production (el contrato E0 no está cargado)"

echo "==> [1/8] Validando commit"
git fetch origin --quiet
git cat-file -e "$SHA^{commit}" 2>/dev/null || fail "el SHA no existe en origin"
git merge-base --is-ancestor "$SHA" origin/main || fail "el SHA no es ancestro de origin/main"

echo "==> [2/8] Asegurando rollback"
PREV_SHA="$(cat "$ACTIVE_SHA_FILE" 2>/dev/null || true)"
if [ -n "$PREV_SHA" ]; then
  docker image inspect "$IMAGE:$PREV_SHA" >/dev/null 2>&1 \
    || fail "no existe la imagen etiquetada de la versión activa ($PREV_SHA)"
else
  # Primer deploy controlado: preservar la imagen corriendo, sin reconstruirla.
  RUNNING_IMG="$(docker inspect pixeltec-os --format '{{.Image}}' 2>/dev/null || true)"
  if [ -n "$RUNNING_IMG" ]; then
    PREV_SHA="pre-hardening"
    docker tag "$RUNNING_IMG" "$IMAGE:$PREV_SHA"
  fi
fi
echo "rollback disponible: ${PREV_SHA:-ninguno (no hay contenedor previo)}"

echo "==> [3/8] Checkout detached de $SHA"
git checkout --quiet --detach "$SHA"

echo "==> [4/8] Contrato E0 (predeploy) — la salida solo lleva nombres/estados"
docker run --rm --env-file "$APP_DIR/.env.production" \
  -v "$APP_DIR/scripts:/s:ro" -w /s node:20 \
  npx -y tsx@4 validate-egress-config.ts --profile=predeploy ${CAPS[@]:+"${CAPS[@]}"} \
  || fail "contrato E0 inválido — no se construye ni se despliega"

echo "==> [5/8] Build versionado $IMAGE:$SHA"
PIXELTEC_OS_IMAGE_TAG="$SHA" docker compose --env-file .env.production build app

echo "==> [6/8] Recreando exclusivamente el servicio app"
PIXELTEC_OS_IMAGE_TAG="$SHA" docker compose --env-file .env.production up -d --no-build app
# El contenedor recreado puede tomar otra IP en web-network; sin reload nginx
# sigue apuntando a la vieja -> 502/504.
docker exec pixeltec-nginx nginx -s reload || true

echo "==> [7/8] Health"
health_check() {
  sleep 8
  local status code login restarts restarts2
  status="$(docker inspect pixeltec-os --format '{{.State.Status}}' 2>/dev/null || echo missing)"
  [ "$status" = "running" ] || { echo "health: contenedor $status"; return 1; }
  restarts="$(docker inspect pixeltec-os --format '{{.RestartCount}}')"
  # Host explícito: el default_server de nginx descarta (444) hosts no configurados.
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HOST_HEADER" http://localhost)"
  login="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HOST_HEADER" http://localhost/login)"
  echo "health: sitio=$code login=$login"
  [ "$code" -ge 200 ] && [ "$code" -lt 400 ] || return 1
  [ "$login" -ge 200 ] && [ "$login" -lt 400 ] || return 1
  # DB y política: sin errores de conexión ni bloqueos inesperados al arrancar.
  if docker logs pixeltec-os --since 2m 2>&1 | grep -qiE "ECONNREFUSED|EgressBlockedError"; then
    echo "health: errores de DB o bloqueo de egress en logs de arranque"; return 1
  fi
  sleep 5
  restarts2="$(docker inspect pixeltec-os --format '{{.RestartCount}}')"
  [ "$restarts2" = "$restarts" ] || { echo "health: restart loop"; return 1; }
  return 0
}

if health_check; then
  echo "==> [8/8] OK — fijando latest y versión activa"
  docker tag "$IMAGE:$SHA" "$IMAGE:latest"
  echo "$SHA" > "$ACTIVE_SHA_FILE"
  echo "DEPLOY OK sha=$SHA imageId=$(docker image inspect -f '{{.Id}}' "$IMAGE:$SHA") utc=$(date -u +%FT%TZ)"
else
  echo "HEALTH FAIL — rollback automático a ${PREV_SHA:-N/A}" >&2
  if [ -n "${PREV_SHA:-}" ]; then
    PIXELTEC_OS_IMAGE_TAG="$PREV_SHA" docker compose --env-file .env.production up -d --no-build app
    docker exec pixeltec-nginx nginx -s reload || true
    sleep 8
    curl -s -o /dev/null -w "rollback health: %{http_code}\n" --max-time 10 -H "Host: $HOST_HEADER" http://localhost || true
  fi
  fail "el health del deploy falló; se restauró la versión anterior"
fi
