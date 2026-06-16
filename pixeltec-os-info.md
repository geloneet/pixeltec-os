# PixelTEC OS — Documento de referencia

**Producción:** https://pixeltec.mx  
**Repositorio local:** `/home/ubuntu/pixeltec-os`  
**Rama principal:** `main` (= producción directa)

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, standalone output, Turbopack en dev) |
| UI | Tailwind CSS 3, shadcn/ui, Radix UI, Lucide React, Framer Motion |
| Auth | Firebase Auth + cookie `__session` verificada con Firebase Admin SDK |
| Base de datos | Firestore (Admin SDK en server / client SDK en browser) |
| AI | Google Genkit 1.x + Anthropic SDK 0.91 |
| Notificaciones | Resend (email transaccional), Meta Cloud API (WhatsApp), grammY (Telegram) |
| Cron / jobs | `node-cron` + endpoints `/api/cron/*` protegidos por `CRON_SECRET` |
| Runtime | Node.js (no Edge — obligatorio para `firebase-admin`) |
| Contenedor | Docker (standalone Next.js) + Nginx en OVH VPS |
| CI | Dependabot (npm + github-actions + docker) |

---

## Módulos de la aplicación

### Rutas admin (auth requerida) — `src/app/(admin)/`

| Ruta | Módulo | Descripción |
|---|---|---|
| `/dashboard` | Dashboard | KPIs en tiempo real: clientes, proyectos, tareas, estado VPS. Cards de acceso rápido. |
| `/clientes` | CRM | Gestión de clientes, pipeline comercial, notas, proyectos asociados. |
| `/clientes/[id]` | CRM detalle | Ficha completa: historial, proyectos, actualizaciones, TaskBoard. |
| `/proyectos/[id]` | Proyectos | Kanban de tareas por proyecto con estados y cliente asociado. |
| `/herramientas` | Herramientas | Biblioteca interna: credenciales, prompts, documentación técnica. |
| `/vps` | DevOps | Estado de servicios VPS, deploys, logs, pausar/reanudar/reiniciar vía API. |
| `/crypto-intel` | Crypto Intel | Precios en tiempo real, alertas configurables (umbral/%), notificaciones Telegram/email. |
| `/asistente` | Asistente IA | Planificador semanal de tareas con IA, historial por semana, templates. |
| `/asistente/historial/[weekKey]` | Historial | Vista de semanas pasadas del asistente. |
| `/asistente/templates` | Templates | Plantillas de tareas reutilizables. |
| `/blog-admin` | Blog Admin | CRUD de artículos del blog. Migración de posts. |
| `/notificaciones` | Notificaciones | Centro de notificaciones del sistema (alertas, actividad). |
| `/perfil` | Perfil | Perfil del usuario autenticado. |

### Rutas públicas

| Ruta | Descripción |
|---|---|
| `/` | Landing page de PIXELTEC |
| `/blog/[slug]` | Blog público (solo posts con `status=published` e `noindex=false`) |
| `/portal` | Login OTP del portal de clientes (código 6 dígitos por email) |
| `/[slug]/dashboard` | Portal de clientes: estado de proyectos sin cuenta, acceso por OTP |
| `/aviso-de-privacidad` | Aviso de privacidad LFPDPPP |
| `/terminos-de-servicio` | Términos de servicio |
| `/contact`, `/services`, `/equipo`, `/metodologia` | Páginas de marketing |

---

## Sistema de IA — Multi-agente con Genkit

El módulo de IA (`src/ai/`) implementa un pipeline de agentes especializados que colaboran para planificar features de software.

### Agentes (`src/ai/agents/`)

| Agente | Rol |
|---|---|
| `ProductOwner` | Convierte requests en specs con user stories y criterios de aceptación |
| `ProjectPlanner` | Descompone specs en tareas técnicas con dependencias |
| `DatabaseArchitect` | Diseña esquemas Firestore, queries e índices |
| `BackendDeveloper` | Genera implementación de Server Actions y API routes |
| `FrontendDeveloper` | Diseña componentes React, hooks y flujo UI |
| `QATester` | Genera casos de prueba y plan de QA |
| `SecurityAuditor` | Audita seguridad: auth, validación, permisos, vulnerabilidades |
| `FixerAgent` | Diagnostica y corrige bugs con análisis root-cause |
| `DevOpsAgent` | Planifica infraestructura, Dockerfile, CI/CD |

### Flows (`src/ai/flows/`)

- `feature-pipeline.ts` — Orquestador principal: encadena agentes en secuencia para pasar de FeatureRequest a plan de implementación completo.
- `content-enhancement-suggestions.ts` — Sugerencias de mejora de contenido.
- `global-strategic-advisor.ts` / `strategic-advisor.ts` — Advisor estratégico de alto nivel.

### Asistente semanal (`/asistente`)

Módulo de planificación semanal personal con IA:
- Tareas organizadas por semana (key `YYYY-WNN`)
- Picker de fecha/hora con TZ centralizado (America/Mexico_City)
- Vista de historial por `weekKey`
- Acciones server-side en `actions.ts` (crear, actualizar, postponer, eliminar tareas)
- Reporte semanal exportable vía WhatsApp

---

## API Routes (`src/app/api/`)

### Auth
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/session` | `POST / DELETE` | Crear / revocar cookie `__session` |

### VPS (todas hardened con `requireAdmin` + `infraAuditLog`)
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/vps/status` | `GET` | Estado del VPS |
| `/api/vps/projects` | `GET` | Lista de proyectos |
| `/api/vps/health` | `GET` | Health check del VPS API |
| `/api/vps/deploy` | `POST` | Disparar deploy (`{ projectId }`) |
| `/api/vps/logs` | `GET` | Logs de un proyecto |
| `/api/vps/pause` | `POST` | Pausar proyecto |
| `/api/vps/resume` | `POST` | Reanudar proyecto |
| `/api/vps/restart` | `POST` | Reiniciar proyecto |

### Notificaciones
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/notifications/send` | `POST` | Enviar notificación |
| `/api/notifications/daily` | `POST` | Resumen diario |
| `/api/notifications/charges` | `POST` | Notificación de cobro |
| `/api/notifications/telegram` | `POST` | Enviar por Telegram |
| `/api/notifications/alert` | `POST` | Alerta del sistema |

### Crypto Intel
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/crypto-intel/prices/sync` | `POST` | Sincronizar precios de mercado |
| `/api/crypto-intel/alerts/evaluate` | `POST` | Evaluar y disparar alertas |
| `/api/crypto-intel/alerts/telegram` | `POST` | Alertas vía Telegram |

### Asistente
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/asistente/test-report` | `GET/POST` | Test del reporte semanal |

### Otros
| Endpoint | Método | Descripción |
|---|---|---|
| `/api/health` | `GET` | Health check de la app |
| `/api/send-email` | `POST` | Email transaccional (Resend) |
| `/api/newsletter` | `POST` | Suscripción al newsletter |
| `/api/cron/asistente` | `POST` | Cron job del asistente (protegido por `CRON_SECRET`) |
| `/api/whatsapp/webhook` | `POST` | Webhook de WhatsApp (Meta Cloud API) |
| `/api/whatsapp/send-test` | `POST` | Test de envío WhatsApp |

---

## Firestore — colecciones

| Colección | Acceso cliente | Descripción |
|---|---|---|
| `users/{uid}` | Solo propio usuario | Perfil y rol |
| `clients/{id}` | `read: public` / `write: auth` | Clientes + pipeline |
| `clients/{id}/updates` | `read: public` / `write: auth` | Actualizaciones del cliente |
| `clients/{id}/projects` | `read: public` / `write: auth` | Proyectos por cliente |
| `clients/{id}/**` | Solo auth | Subcolecc. adicionales (tasks, notas) |
| `leads` | **Denegado** (solo Admin SDK) | Leads del funnel de contacto |
| `tickets` | Auth | Tickets de soporte |
| `finances` | Auth | Datos financieros |
| `activity` | Auth | Log de actividad |
| `tasks` | Auth | Tareas globales |
| `crm_data/{uid}` | Solo propio usuario | Estado blob del CRM |
| `notifications/{id}` | Solo propio usuario (read/update read flag) | Notificaciones in-app |
| `blogBriefs` | **Denegado** (solo Admin SDK) | Borradores de blog |
| `blogPosts` | Público (solo published + noindex=false) | Artículos publicados |
| `alertRules`, `alerts`, `prices`, `priceSnapshots`, `cryptoIntelLogs`, `telegramUsers`, `telegramSessions` | **Denegado** (solo Admin SDK) | Crypto Intel — backend only |
| `newsletterSubscribers`, `rateLimit`, `systemAlerts` | **Denegado** (solo Admin SDK) | Funnel público — backend only |
| `authLockouts` | **Denegado** (solo Admin SDK) | Anti-brute-force |

---

## Seguridad

- **Middleware** (`src/middleware.ts`): verifica `__session` con `verifySessionCookie()` en cada request a rutas protegidas. Expiradas → `/login?error=session_expired`. Fail-open en errores de infra.
- **Portal OTP**: cookie HMAC `httpOnly`, `requirePortalSession`, `crypto.randomInt`, expiración 7 días.
- **VPS API**: `requireAdmin` guard + `sanitizeVpsPayload` + `infraAuditLog` en las 7 rutas.
- **Rate limiting**: `src/lib/rate-limit.ts` — protección en endpoints públicos.
- **Auth brute-force**: `src/lib/auth-brute-force.ts` + colección `authLockouts` (Admin SDK).
- **Firestore Rules**: crypto-intel y funnel denegados al cliente. IDOR prevenido con ownership checks en server actions.
- **CSP**: rama `security/login-hardening-csp-report-only` en Report-Only con telemetría en `cspViolations`.

---

## Emails transaccionales (`src/emails/`)

Plantillas Resend:

| Archivo | Propósito |
|---|---|
| `WelcomeEmail.ts` | Bienvenida a nuevo usuario |
| `ClientAccessEmail.ts` | Acceso al portal de cliente (OTP) |
| `ContactConfirmationEmail.ts` | Confirmación de contacto al visitante |
| `ContactNotificationEmail.ts` | Notificación interna de nuevo contacto |
| `ProjectUpdateEmail.ts` | Actualización de proyecto al cliente |
| `InvoiceEmail.ts` | Factura / cobro |
| `NewsletterWelcomeEmail.ts` | Bienvenida al newsletter |
| `TaskAssignedEmail.ts` | Tarea asignada |
| `SupportTicketEmail.ts` | Ticket de soporte |

---

## Componentes clave (`src/components/`)

| Componente | Descripción |
|---|---|
| `nav/command-palette.tsx` | Command palette ⌘K (Radix Dialog + cmdk) — navegación principal |
| `nav/desktop-sidebar.tsx` | Sidebar visible ≥1280px |
| `nav/global-header.tsx` | Header persistente con acceso al palette en mobile |
| `cmd-k/CmdKProvider.tsx` | Estado global del palette |
| `crm/CRMShellProvider.tsx` | Shell CRM con estado global, vistas y navegación interna |
| `crm/ServerView.tsx` | Vista detallada de servidor/VPS (componente más grande, 43KB) |
| `crm/ProjectView.tsx` | Vista de proyecto con Kanban |
| `dashboard/AIAdvisor.tsx` | Widget de advisor IA en dashboard |
| `dashboard/TaskBoard.tsx` | Board de tareas del dashboard |

---

## Navegación

- **Método principal:** Command palette `⌘K` / `Ctrl+K` — fuzzy search para secciones, clientes, proyectos, tareas, VPS.
- **Mobile:** botón **⊞ Menú** en el header (esquina superior derecha).
- **Desktop:** sidebar visible ≥1280px como atajos visuales.
- **Recientes:** historial en `localStorage`.

---

## Infraestructura

```
OVH VPS
├── pixeltec-infra/         — Nginx (reverse proxy) + Certbot
│   └── docker-compose.yml  — red: web-network (external)
└── pixeltec-os/            — Esta app
    └── docker-compose.yml  — container: pixeltec-os, sin port binding (interno por web-network)
```

- `pixeltec.mx → Nginx → web-network → pixeltec-os:3000`
- Build args de Firebase inyectados como Docker ARG (variables `NEXT_PUBLIC_*`)
- Runtime vars en `.env.production` (nunca en el repo)
- `restart: unless-stopped`

### Comandos operativos críticos

```bash
# Deploy completo (SIEMPRE así — restart NO recarga env_file)
docker compose build --no-cache app && docker compose up -d --force-recreate app

# Después de force-recreate
docker exec pixeltec-nginx nginx -s reload

# Logs en vivo
docker compose logs -f app

# Verificar BUILD_ID activo
docker compose exec app cat .next/BUILD_ID

# curl SIEMPRE con --compressed (Next.js 15 PPR comprime)
curl --compressed https://pixeltec.mx/api/health

# Aplicar Firestore rules
firebase deploy --only firestore:rules
```

---

## Variables de entorno

### Build-time (Docker ARG → `NEXT_PUBLIC_*`)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_LOGO_URL
NEXT_PUBLIC_PROFILE_PHOTO_URL
```

### Runtime (`.env.production` — nunca en el repo)
```
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
PORTAL_SESSION_SECRET          # HMAC de cookies del portal
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
CRON_SECRET
VPS_API_URL
VPS_API_KEY
RESEND_API_KEY
WHATSAPP_API_TOKEN
WHATSAPP_PHONE_NUMBER_ID
ANTHROPIC_API_KEY
GOOGLE_GENAI_API_KEY
```

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar con credenciales Firebase
npm run dev                         # http://localhost:9002 (Turbopack)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint
```

> El middleware usa `firebase-admin` con Node.js runtime. No funciona en Edge — todas las rutas que usan Admin SDK deben declarar `export const runtime = 'nodejs'`.

---

## Estado git reciente (2026-06-16)

```
1361b19  chore(ci): enable Dependabot for npm + github-actions + docker
67b9a66  chore(asistente): batch cleanup — orphan file, as const, week-end ms
7d0b55f  fix(asistente): a11y on task-card trigger and date-time-picker
846ac21  fix(asistente): hoist getCurrentWeekKey to server — kill hydration mismatch
79fec2a  hotfix(asistente): TaskFormDialog reset al abrir + defaults sensatos
40a1f86  fix(asistente): return full serialized task from create/updateTask
00b348b  fix(asistente): harden date/time validation, postpone gating, delete confirm
6d2f30b  feat(asistente): in-system date/time picker, TZ centralization, ESLint guard
740602f  feat(nav): start sidebar with Sistema section
996ea63  feat(assistant): Fase 4 — weekly report WhatsApp delivery
397ea6c  refactor(notifications): migrate transport from Twilio to Meta Cloud API
```

Archivos sin trackear: `.env.production.backup-pre-deploy-20260513-032254`, `docs/legal/`, `docs/superpowers/`.
