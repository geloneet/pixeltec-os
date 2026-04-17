# Runbook — Merge & Deploy de feat/vps-api-migration-v3

## Pre-requisitos

- [ ] Sesión SSH al VPS como user `ubuntu`
- [ ] vps-api v3 corriendo en PM2 (`pm2 describe vps-api | grep status` → online)
- [ ] https://api.pixeltec.mx/health/api responde 200
- [ ] Estás parado en main con working tree clean

## Pasos de deploy

### 1. Editar `.env.production` en el VPS (NO está en Git)

    nano /home/ubuntu/pixeltec-os/.env.production

Agregar al final (si no existe):

    VPS_API_URL=https://api.pixeltec.mx

Guardar. NO cambies CRON_SECRET.

### 2. Merge de la rama a main

    cd /home/ubuntu/pixeltec-os
    git checkout main
    git merge feat/vps-api-migration-v3
    git log --oneline -3   # verificar que el commit feat(vps-api) está arriba

### 3. Rebuild + redeploy del CRM

    docker compose build --no-cache app
    docker compose up -d app

    # Observar arranque
    docker logs -f pixeltec-os

Esperar hasta ver `Ready in X ms` o similar. Ctrl+C después.

### 4. Smoke test

Abrir https://pixeltec.mx en navegador, loguear, ir al módulo VPS / Projects.
Todas las operaciones (list, status, logs) deben funcionar igual que antes.

En terminal, verificar logs del vps-api para ver requests llegando con la IP pública real (198.100.155.231) en vez de 172.18.0.2:

    pm2 logs vps-api --lines 15 --nostream

Esperado: líneas tipo `GET /status ip=198.100.155.231 status=200`.

### 5. Rollback (si algo sale mal)

Opción A — revertir el commit y rebuild:

    cd /home/ubuntu/pixeltec-os
    git revert HEAD --no-edit
    docker compose build --no-cache app
    docker compose up -d app

Opción B — revertir .env.production (vps-api ya aceptaba el legacy, esto NO ayuda
porque el CRM ahora llama por api.pixeltec.mx literal en el código). SIEMPRE usar opción A.

## Después del deploy (Fase 3.G en próxima sesión)

Una vez confirmado que el CRM consume vía api.pixeltec.mx en producción sin errores
durante al menos 24h, avanzar a Fase 3.G:
- Cambiar VPS_API_HOST=127.0.0.1 en /home/ubuntu/vps-api/.env
- `pm2 restart vps-api`
- Verificar que :3005 ya NO responde desde fuera (solo localhost)
