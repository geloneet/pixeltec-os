# Notificaciones de decisión de propuesta + retiro del bot de Telegram

**Fecha:** 2026-07-15 · **Aprobado por:** Miguel (CEO) · **Estado:** diseño aprobado

## Contexto

Cuando un cliente decide una propuesta en la página pública `/p/[token]`, hoy no se
notifica a nadie: el admin se entera hasta que abre el CRM. Miguel pidió tres avisos al
aceptar: mensaje de bot a su número personal, correo al admin y notificación in-app.
Decidió además retirar por completo el bot de Telegram (solo WhatsApp queda activo).

Toda la infraestructura ya existe:

- **WhatsApp**: `src/lib/whatsapp/sender.ts` (Meta Cloud API, `WHATSAPP_DEFAULT_TO` =
  número personal de Miguel). Mismo transport de los avisos daily/charges.
- **Email**: `src/lib/email.ts` (Resend, `PIXELTEC_TEAM_EMAIL` = equipo@pixeltec.mx) +
  templates en `src/emails/`.
- **In-app**: `createNotification` (`src/lib/db/repos/notifications.ts`, tabla
  `notifications` por `userId`), campana ya montada en el dashboard.

## Parte A — Notificaciones al decidir la propuesta

**Disparo:** en `POST /api/proposals/action` (`src/app/api/proposals/action/route.ts`),
solo cuando `updateProposalActionStatus` regresa `ok`. Esa transición ya es idempotente
(segunda decisión → `already_decided`, 409), por lo que cada propuesta notifica **una
sola vez**.

**Mecanismo:** `after()` de Next — la respuesta al cliente no espera las notificaciones.
Cada canal va en su propio `try/catch`; un canal caído se loguea
(`[proposals/action] notify <canal> FAILED`) y no afecta ni a los otros canales ni a la
decisión ya guardada.

**Cubre ambas decisiones:** `aceptada` (✅) y `rechazada` (❌), mismo mecanismo, texto
distinto.

**Canales:**

1. **WhatsApp** al número default:
   `✅ {Cliente} aceptó la propuesta «{Título}»{ — $X MXN}` + link `pixeltec.mx/crm`.
   El monto sale de `billingItemDrafts` si hay conceptos (suma de pagos únicos +
   indicación de recurrentes); si no hay, se omite.
2. **Email** a `PIXELTEC_TEAM_EMAIL`: template nuevo `ProposalDecisionEmail`
   (`src/emails/`), mismo patrón visual/estructura de `DiagnosticNotificationEmail`.
   Asunto: `✅ Propuesta aceptada: {Título} — {Cliente}` (o ❌ rechazada).
3. **In-app**: `createNotification` para **todos los usuarios staff** (iteración sobre
   `users`, patrón del daily cron), `type: "success"` / `"warning"`, `href` al workspace
   del cliente con la pestaña Propuesta (`/dashboard/...?tab=propuesta`), `source:
   "proposal-decision"`.

**Datos para el mensaje:** la propuesta ya trae `clientId`/título; se resuelve el nombre
del cliente server-side. Si el nombre no se puede resolver, se usa "Un cliente" y se
notifica igual (nunca se bloquea el aviso por datos incompletos).

## Parte B — Retiro total del bot de Telegram

1. **Borrar rutas**: `src/app/api/notifications/telegram/webhook/route.ts` y
   `src/app/api/notifications/alert/route.ts` (sin callers en `main`; protegido por
   `CRON_SECRET` y nada lo invoca — verificado en pixeltec-infra, vps-api y crontab).
2. **Borrar libs**: `src/lib/notifications/{infra-bot,telegram,telegram-auth,silence,
   alert-formatter,rate-limit}.ts` y los tipos de alerta en
   `src/lib/notifications/types.ts` si quedan sin otros consumidores.
3. **Dependencia**: quitar `grammy` de `package.json`.
4. **Base de datos**: migración que hace `DROP TABLE` de `infra_silences` e
   `infra_command_log` (solo logs internos del bot, sin datos de negocio) y elimina sus
   definiciones de `schema.ts`.
5. **Env vars**: quitar `TELEGRAM_*` de `.env` y de la documentación de envs.
6. **BotFather (acción de Miguel)**: borrar el bot con `/deletebot`. Esto **cierra
   TOKEN-001** (token expuesto — muere el bot, muere el token; ya no se rota).
7. **Deuda anotada**: la rama sin mergear `feature/flujo-comercial-fase2` llama
   `/api/notifications/alert` desde `src/lib/assistant/rollover.ts`; al mergearla habrá
   que redirigir esa alerta a WhatsApp (`sendWhatsApp`). No bloquea este trabajo.

## Manejo de errores

- Notificaciones nunca hacen fallar la decisión del cliente (ya guardada al momento de
  notificar). Fallos → `console.error` con prefijo identificable.
- WhatsApp fuera de ventana de 24h (error Meta 131047) se loguea; no hay reintento
  automático en v1 (el email e in-app cubren la redundancia).

## Testing

- Unit: helper que arma los textos de los mensajes (aceptada/rechazada, con/sin montos,
  cliente sin nombre) — vitest, patrón de `proposal-content.test.ts`.
- Integración manual en dev (9002): aceptar una propuesta de prueba → verificar WhatsApp
  real, email real a equipo@, campana in-app; segunda decisión → 409 sin re-notificar.
- Post-retiro Telegram: `npm run build` limpio sin grammy; grep sin referencias
  `telegram|TELEGRAM` en `src/`; migración aplicada en dev.

## Fuera de alcance

- Reintentos/cola de notificaciones fallidas.
- Notificar otros eventos (contrato firmado, pago registrado) — candidatos a fase 2.
- Adaptación de `rollover.ts` en `flujo-comercial-fase2` (se hace al mergear esa rama).
