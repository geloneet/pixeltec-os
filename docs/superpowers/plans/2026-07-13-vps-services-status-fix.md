# vps-api services.js — status fix (pm2 normalize + systemd)

**Goal:** eliminar falsos "rojos" en el audit (servicios pm2 sanos reportan `online`, no `running`) y dar status real a servicios systemd (modar_bot, pixelbet), hoy `manual`.

**Contexto:** `src/health/services.js` `getProjectStatus` mapea docker→`running`, pm2→`f.pm2_env.status` (devuelve `"online"` sano). El motor de síntomas (`symptoms.js`) trata todo lo que no sea `running/paused/manual` como caído→🔴. Por eso vps-api/viva-bot/PDF-Manager salen rojos falsos. systemd no está soportado (cae en unknown/manual).

## Cambios (vps-api, rama `feat/services-status`)

### services.js
- **pm2**: normalizar `online → running` (y `stopping/launching → running`? no: solo `online`). Resto (`stopped/errored`) → dejar tal cual (se mapean a no-running → 🔴, correcto).
  `status = f ? (f.pm2_env.status === "online" ? "running" : f.pm2_env.status) : "stopped"`
- **systemd**: nuevo branch `p.type === "systemd"` con `p.systemdUnit` (o derivar de `p.id`):
  `const r = await exec("systemctl is-active " + unit); status = r.stdout.trim() === "active" ? "running" : "stopped"` (degradar a "stopped" en catch).
- Test (`node:test`): stubbing `exec`, verificar: pm2 online→running; pm2 stopped→stopped; systemd active→running; systemd inactive→stopped.

### Registro (pixeltec-infra/projects.json vía saveProjects)
- `modar-bot`: type `manual` → `systemd`, agregar `systemdUnit:"modar_bot"`.
- `pixelbet`: type `manual` → `systemd`, agregar `systemdUnit:"pixelbet"`.
- (v1ToV2 debe preservar `systemdUnit`; si el schema lo descarta, guardarlo en un campo que sobreviva — verificar tras saveProjects que loadProjects lo devuelve.)

## Deploy (con GO ya dado)
1. merge `feat/services-status` → main de vps-api.
2. Actualizar registro (types systemd) vía saveProjects, backup previo.
3. `pm2 restart vps-api`.
4. Verificar: `/health/audit` — los servicios pm2 sanos ya NO salen rojos; modar_bot/pixelbet muestran running.

## Verificación
`node --test` verde; audit live antes/después (red baja al quitar falsos positivos).
