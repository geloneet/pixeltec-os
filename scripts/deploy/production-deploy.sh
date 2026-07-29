#!/usr/bin/env bash
# Deploy de producción de PixelTEC OS — motor manual gobernado (E0g-3 → M1A).
#
# Corre EN el VPS, invocado por el comando instalado /usr/local/sbin/deploy-pixeltec-os
# (plantilla versionada: scripts/deploy/deploy-pixeltec-os-wrapper.sh), que lo
# extrae DEL SHA aprobado: `git show <sha>:scripts/deploy/production-deploy.sh`.
# GitHub Actions NO participa en producción: el único camino productivo es el
# deploy manual gobernado desde el VPS.
#
# Garantías:
#   - SHA hexadecimal completo, existente y ancestro de origin/main.
#   - El checkout canónico (/home/ubuntu/pixeltec-os) NUNCA se muta: este motor
#     no ejecuta checkout/switch/reset; el build sale de una RELEASE INMUTABLE
#     creada con `git archive <sha>` en /home/ubuntu/pixeltec-os-releases/<sha>.
#   - `validate:egress --profile=predeploy` ANTES de build/activación;
#     capabilities solo las aprobadas por argumentos (mínimo privilegio).
#   - Imagen etiquetada por SHA (pixeltec-os-app:<sha>); `latest` solo se mueve
#     tras health OK. Sin prune: se conservan como mínimo la imagen activa y la
#     anterior; la imagen fallida se conserva para diagnóstico.
#   - Recrea EXCLUSIVAMENTE el servicio `app` (`--no-deps`: db y qa-runner
#     intactos); rollback automático ante health FAIL usando .deploy-active-sha.
#   - `--check-only`: ejecuta TODAS las validaciones (SHA, rollback disponible,
#     release, compose config, contrato E0) sin build, sin up, sin reload, sin
#     mover imágenes y sin escribir .deploy-active-sha.
#   - Nunca imprime valores del entorno; prohibido `set -x`.
set -euo pipefail

APP_DIR=/home/ubuntu/pixeltec-os
RELEASES_DIR=/home/ubuntu/pixeltec-os-releases
IMAGE=pixeltec-os-app
PROJECT=pixeltec-os
ACTIVE_SHA_FILE="$APP_DIR/.deploy-active-sha"
HOST_HEADER=pixeltec.mx

fail() { echo "DEPLOY FAIL: $1" >&2; exit 1; }

SHA="${1:-}"
shift || true
CAPS=()
CHECK_ONLY=0
for c in "$@"; do
  case "$c" in
    --require-r2-delete|--require-meta-credential-read|--require-meta-publish)
      CAPS+=("$c") ;;
    --check-only) CHECK_ONLY=1 ;;
    *) fail "argumento desconocido: $c" ;;
  esac
done

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "commit_sha debe ser un SHA hexadecimal completo (40)"
[ -f "$APP_DIR/.env.production" ] || fail "falta .env.production (el contrato E0 no está cargado)"

echo "==> [1/9] Validando commit (sin mutar el checkout)"
git -C "$APP_DIR" fetch origin --quiet
git -C "$APP_DIR" cat-file -e "$SHA^{commit}" 2>/dev/null || fail "el SHA no existe en origin"
git -C "$APP_DIR" merge-base --is-ancestor "$SHA" origin/main \
  || fail "el SHA no es ancestro de origin/main"

echo "==> [2/9] Asegurando rollback"
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

echo "==> [3/9] Release inmutable $RELEASES_DIR/$SHA (git archive, sin .git ni secretos)"
RELEASE_DIR="$RELEASES_DIR/$SHA"
umask 077
mkdir -p "$RELEASES_DIR"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
git -C "$APP_DIR" archive "$SHA" | tar -x -C "$RELEASE_DIR"
for f in Dockerfile docker-compose.yml scripts/validate-egress-config.ts \
         scripts/deploy/production-deploy.sh; do
  [ -f "$RELEASE_DIR/$f" ] || fail "release incompleta: falta $f"
done
[ ! -e "$RELEASE_DIR/.git" ] || fail "la release no debe contener .git"
# La release NO contiene NINGÚN archivo de entorno real (ni archivo, ni
# symlink, ni copia): el contrato E0 entra por ruta canónica absoluta y, al
# build, SOLO como BuildKit secret. Excepciones versionadas — exactamente las
# DOS plantillas del repo, lista cerrada y explícita: .env.example y
# .env.production.example (marcadores/documentación, sin valores productivos).
ENV_LEAK="$(find "$RELEASE_DIR" -name ".env*" \
  ! -name ".env.example" ! -name ".env.production.example" -print -quit)"
[ -z "$ENV_LEAK" ] || fail "archivo de entorno no permitido dentro de la release: $ENV_LEAK"
grep -qE '^\.env\.production$' "$RELEASE_DIR/.dockerignore" \
  || fail ".dockerignore de la release no excluye .env.production"
grep -qE '^!\.env\.example$' "$RELEASE_DIR/.dockerignore" \
  || fail ".dockerignore de la release no conserva .env.example"
grep -q 'type=secret,id=env_production' "$RELEASE_DIR/Dockerfile" \
  || fail "Dockerfile de la release no monta el BuildKit secret env_production"
grep -q 'env_production' "$RELEASE_DIR/docker-compose.yml" \
  || fail "docker-compose.yml de la release no declara el build secret env_production"

# Ruta canónica del contrato E0: la fija ESTE motor (no es argumento del
# operador). El archivo permanece fuera del build context; Compose la
# interpola en env_file y como fuente del BuildKit secret.
PIXELTEC_OS_ENV_FILE="$APP_DIR/.env.production"
PERMS_OTROS="$(stat -c %a "$PIXELTEC_OS_ENV_FILE" | tail -c 2)"
[ "$PERMS_OTROS" = "0" ] \
  || fail ".env.production es legible por 'otros' (chmod o= requerido)"

# Todas las invocaciones de Compose: project name literal del proyecto activo
# + archivo de la release (build context = release, no el checkout) + ruta
# canónica absoluta del entorno.
COMPOSE=(env "PIXELTEC_OS_ENV_FILE=$PIXELTEC_OS_ENV_FILE"
         docker compose -p "$PROJECT" -f "$RELEASE_DIR/docker-compose.yml"
         --env-file "$PIXELTEC_OS_ENV_FILE")

echo "==> [4/9] Validando configuración Compose de la release"
PIXELTEC_OS_IMAGE_TAG="$SHA" "${COMPOSE[@]}" config --quiet \
  || fail "docker-compose.yml de la release no valida"

echo "==> [5/9] Contrato E0 (predeploy) — la salida solo lleva nombres/estados"
docker run --rm --env-file "$PIXELTEC_OS_ENV_FILE" \
  -v "$RELEASE_DIR/scripts:/s:ro" -w /s node:20 \
  npx -y tsx@4 validate-egress-config.ts --profile=predeploy ${CAPS[@]:+"${CAPS[@]}"} \
  || fail "contrato E0 inválido — no se construye ni se despliega"

if [ "$CHECK_ONLY" = 1 ]; then
  echo "CHECK-ONLY OK sha=$SHA release=$RELEASE_DIR utc=$(date -u +%FT%TZ) — sin build, sin activación, sin cambios"
  exit 0
fi

echo "==> [6/9] Build versionado $IMAGE:$SHA (producción intacta durante el build)"
PIXELTEC_OS_IMAGE_TAG="$SHA" "${COMPOSE[@]}" build app

echo "==> [7/9] Recreando exclusivamente el servicio app (db y qa-runner intactos)"
PIXELTEC_OS_IMAGE_TAG="$SHA" "${COMPOSE[@]}" up -d --no-build --no-deps app
# El contenedor recreado puede tomar otra IP en web-network; sin reload nginx
# sigue apuntando a la vieja -> 502/504.
docker exec pixeltec-nginx nginx -s reload || true

echo "==> [8/9] Health"
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
  echo "==> [9/9] OK — fijando latest y versión activa"
  docker tag "$IMAGE:$SHA" "$IMAGE:latest"
  echo "$SHA" > "$ACTIVE_SHA_FILE"
  echo "DEPLOY OK sha=$SHA imageId=$(docker image inspect -f '{{.Id}}' "$IMAGE:$SHA") utc=$(date -u +%FT%TZ) rollback=no"
else
  echo "HEALTH FAIL — rollback automático a ${PREV_SHA:-N/A}" >&2
  if [ -n "${PREV_SHA:-}" ]; then
    PIXELTEC_OS_IMAGE_TAG="$PREV_SHA" "${COMPOSE[@]}" up -d --no-build --no-deps app
    docker exec pixeltec-nginx nginx -s reload || true
    sleep 8
    curl -s -o /dev/null -w "rollback health: %{http_code}\n" --max-time 10 -H "Host: $HOST_HEADER" http://localhost || true
  fi
  echo "DEPLOY FAILED sha=$SHA utc=$(date -u +%FT%TZ) rollback=${PREV_SHA:-none} — imagen fallida $IMAGE:$SHA conservada para diagnóstico" >&2
  fail "el health del deploy falló; se restauró la versión anterior"
fi
