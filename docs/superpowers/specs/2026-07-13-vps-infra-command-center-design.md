# Centro de Control de Infraestructura — rediseño de `/vps`

**Fecha:** 2026-07-13 · **Estado:** aprobado (brainstorming) · **Autor:** sesión con Miguel

## Contexto y problema

PixelTEC opera **toda su agencia en un solo VPS** (Ubuntu 22.04, 6 vCPU/11 GB/97 GB,
`198.100.155.231`): nginx como único entrypoint → 17 contenedores + servicios de host,
sirviendo 13 dominios propios y de clientes, 2 instancias Postgres y 3 bots de Telegram.

Hoy existe una página `/vps` en PixelTEC OS y un `vps-api` (host, PM2, `api.pixeltec.mx`)
que ya sabe leer estado y ejecutar acciones. Pero la página no da la foto operativa que
un dueño de agencia necesita para **detectar síntomas antes de que un cliente llame**:
disco por llenarse, cert por vencer, backup sin cobertura, DB sin respaldo, crash-loops,
postura de seguridad. Una auditoría del 2026-07-13 encontró huecos concretos: backups
solo locales (sin offsite), 2 tokens de Telegram en claro en logs, SSH con password,
PDF-Manager con 91k reinicios históricos, `vps-projects.json` desincronizado (10 vs 17).

**Objetivo:** convertir `/vps` en un **command center** que (1) monitoree salud por
cliente y del host, (2) permita ejecutar acciones seguras (backup, auditoría, reinicio),
y (3) entregue un **reporte de síntomas priorizado y accionable**. Sin paja: cada panel
y acción responde a un modo de falla real de un VPS multi-cliente.

## No-objetivos (v1)

- Acciones destructivas (borrar recursos, migraciones, `docker system prune` manual).
- Deploy desde la UI (ya existe vía CI; fuera de alcance del centro de monitoreo).
- Monitoreo histórico de series de tiempo / Grafana / Prometheus (over-engineering para
  una sola máquina; el snapshot en vivo + auditoría bajo demanda cubren la necesidad).
- Multi-servidor (hoy es un solo VPS; el diseño no asume más de uno, pero no lo impide).

## Arquitectura

```
PixelTEC OS  /vps (React, dashboard)
     │  vpsClient.ts  (valida sesión admin del CRM → CRON_SECRET)
     ▼
vps-api  (host, PM2, dual-auth)          ← única superficie privilegiada
     │  exec.js / docker / pm2 / systemctl / psql / openssl / ufw / fail2ban
     ▼
VPS (host + contenedores + Postgres)
```

**Por qué vps-api y no server actions del OS:** PixelTEC OS corre en un contenedor sin
acceso al host, así que no puede ver `pm2`/`systemctl`/discos del host. vps-api corre en
el host, ya es privilegiado, ya tiene `execAsync`, doble auth (CRON_SECRET + Bearer) y
caché. Reusar esa superficie (ya endurecida: loopback + subredes Docker en UFW) evita
abrir un segundo canal privilegiado.

**Registro fuente de verdad:** `vps-projects.json` (id, name, desc, type, domain,
containerName/pm2Name, comandos). Parte del trabajo es **reconciliarlo a los 17 servicios
reales** para que el dashboard no omita clientes.

## Componentes

### 1. `vps-api`: endpoints nuevos

Todos montados detrás del `auth.js` existente (CRON_SECRET o Bearer). Los de acción
además exigen que el llamador sea PixelTEC OS con sesión admin (el OS ya hace
`requireSession` antes de llamar vía `vpsClient.ts`).

- **`GET /health/snapshot`** — agrega todos los paneles en un JSON, caché ~30s
  (patrón de `status.js`). Estructura: `{ host, disk, services[], databases[], certs[],
  backups, security, generatedAt }`. Fuentes por sección en §Paneles.
- **`GET /health/audit`** — corre el snapshot y aplica umbrales (§Motor de síntomas) →
  `{ symptoms: [{ id, severity, area, message, suggestedAction, evidence }], summary:
  {red,yellow,green}, generatedAt }`. Sin caché (siempre fresco).
- **`POST /actions/backup`** — ejecuta `/home/ubuntu/scripts/pg-backup-all.sh`, devuelve
  `{ ok, durationMs, tail }` (últimas líneas del log). Idempotente y no destructivo.
- **Existentes que se conservan:** status, restart, pauseResume, logs, diskAlert.

**Log de auditoría de acciones:** toda acción (backup, restart, pause, resume) se anexa
como línea JSON a `/home/ubuntu/logs/vps-actions.log`:
`{ ts, actor, action, target, result }`. `actor` lo pasa el OS desde la sesión admin.

### 2. Paneles (lectura) — fuente de cada dato

| Panel | Datos | Fuente concreta |
|---|---|---|
| 1. Salud por cliente | estado (up/down/paused), uptime, HTTP del dominio, CPU/RAM | `getProjectStatus` (reusar) + `docker stats --no-stream` / `pm2 jlist` + `curl -o /dev/null -w %{http_code}` al dominio |
| 2. Almacenamiento | disco global + tendencia + desglose Docker/DBs/logs/backups | `df -h /`, `docker system df`, `du -sh` de dirs clave |
| 3. Bases de datos | tamaño, conexiones, último backup OK por DB | `psql pg_database_size`/`pg_stat_activity` (host 14/16 + `docker exec … psql`), cruce con `backups/postgres/dumps/*` |
| 4. Certificados TLS | días a expirar por dominio | `openssl x509 -enddate` sobre `ssl/live/*/fullchain.pem` |
| 5. Backups | último run OK, cobertura, tamaño, offsite sí/no | parse de `backup-all.log`, listado de dumps, flag offsite (config) |
| 6. Seguridad | puertos públicos vs política, fail2ban bans, updates de seguridad, SSH password, secretos en logs | `ufw status`, `fail2ban-client status sshd`, `apt-check`, `sshd -T`, scan `journalctl`/logs por patrón token |
| 7. Salud del host | CPU/RAM/carga, servicios caídos, crash-loops | `uptime`, `free`, `systemctl is-active`, `pm2 jlist` (restarts) |

### 3. Motor de síntomas (auditoría #9) — umbrales

Cada check produce 🟢/🟡/🔴 + acción sugerida. Umbrales iniciales (ajustables en config):

| Síntoma | 🟡 | 🔴 | Acción sugerida |
|---|---|---|---|
| Disco | >75% | >85% | Limpiar Docker / revisar logs / ampliar |
| Cert TLS | <21 d | <10 d | Revisar renovación certbot |
| Backup | último >26h | falló o falta cobertura | Correr backup / revisar script |
| DB sin backup | — | sin dump <48h | Añadir DB a pg-backup-all |
| Servicio | HTTP≠2xx/3xx | caído/stopped | Reiniciar / ver logs |
| Crash-loop | restarts>50/día | restarts>500/día | Fijar causa (ej. pin httpx) |
| Updates seguridad | >0 | — | Aplicar en ventana |
| Puerto fuera de política | — | público ≠ 22/80/443 | Acotar en UFW |
| SSH password | activo | — | Pasar a solo-llave |
| Secreto en logs | — | token/clave detectada | Rotar + silenciar logger |
| RAM/carga | RAM>85% o load>nproc | RAM>95% | Investigar proceso |

### 4. PixelTEC OS `/vps`: dashboard

- Reconstruir `vps-dashboard.tsx` consumiendo `/health/snapshot` (SWR/polling ~30s).
- 7 secciones (los paneles); reusar `status-dot`, `project-card`, `server-stats-header`,
  `logs-sheet`, `action-confirm-dialog` existentes; extender con las secciones nuevas.
- Barra de acciones: **Backup**, **Auditoría de salud** (abre el reporte de síntomas),
  y por servicio **Reiniciar/Pausar/Reanudar** (confirmación) + **Logs**.
- Reporte de síntomas: vista priorizada 🔴→🟡→🟢, cada ítem con evidencia + acción.

## Seguridad y altitud

- Lectura: segura, cacheada, sin efectos.
- Acciones: reversibles, con confirmación en UI, y **registradas** con actor de la sesión.
- Nada destructivo en v1 (ver No-objetivos).
- vps-api ya está acotado (UFW loopback + subredes Docker) y con doble auth; no se abre
  superficie nueva. El OS solo llama con sesión admin válida.
- Los comandos de `exec` usan argumentos fijos / lista blanca del registro — nunca
  interpolan input libre del usuario en el shell.

## Manejo de errores

- Cualquier check que falle degrada a `unknown` en su panel (no tumba el snapshot),
  con la razón visible. Patrón ya usado en `status.js`.
- Timeouts por check (evita que un `curl` colgado bloquee el snapshot).
- La acción de backup reporta fallo real con el tail del log (nunca "ok" falso).

## Testing / verificación

- Unit: motor de síntomas (dado un snapshot sintético → severidades esperadas).
- Integración vps-api: cada endpoint devuelve la forma esperada contra el host real.
- E2E manual: abrir `/vps`, ver los 7 paneles poblados, correr **Auditoría** y validar que
  el reporte marca los síntomas reales conocidos (backup sin offsite, SSH password,
  crash-loop de PDF-Manager, tokens en log), correr **Backup** y confirmar dump nuevo.
- `npx tsc --noEmit`, `npm run lint`, `npm test` en pixeltec-os.

## Entregable 2 — documentación en NeuroPIXEL (vault)

Reescribir `01_CONTEXT/infraestructura.md` como la guía de **cómo operar un VPS
multi-cliente correctamente**: modelo de aislamiento por cliente, seguridad (superficie,
secretos, SSH, TLS), **backups 3-2-1** (3 copias, 2 medios, 1 offsite), monitoreo y
síntomas, eficiencia de recursos, y runbooks (backup, restore, auditoría, alta/baja de
cliente). Es la teoría que respalda el dashboard. Se propone antes de commitear; sin push
(gate #5 abierto).

## Fuera de alcance / dependencias

- **Backup offsite** (P0 de la auditoría) es prerequisito para que el panel #5 muestre
  "offsite: sí". La acción de backup puede correr local desde v1; el offsite se añade
  cuando se configure `rclone` + destino (tarea separada, ya recomendada).
- Reconciliar `vps-projects.json` (10→17) es parte del trabajo de este build.
