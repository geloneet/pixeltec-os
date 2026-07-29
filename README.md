# PixelTEC OS

Sistema operativo interno de PixelTEC — CRM, gestión de proyectos, DevOps, inteligencia crypto y portal de clientes, todo en una sola aplicación.

**Producción:** https://pixeltec.mx

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, standalone output) |
| UI | Tailwind CSS, shadcn/ui, Radix UI, Lucide React |
| Auth | NextAuth v5 (credenciales) — sesión JWT; identidad canónica `users.id` |
| Base de datos | PostgreSQL 16 + Drizzle ORM (contenedor propio, red interna) |
| Bot | grammY (Telegram) — alertas crypto |
| AI | Genkit |
| Infraestructura | Docker + Nginx en OVH VPS |
| Runtime middleware | Node.js (`nodeMiddleware: true` en Next.js 15.2+) |

---

## Módulos

### `/dashboard`
Centro de control. KPIs en tiempo real (clientes, proyectos, tareas, VPS) + cards de acceso rápido a cada módulo.

### `/hoy`
Vista diaria: tareas pendientes, pomodoro y agenda del día.

### `/clientes`
CRM completo. Gestión de clientes, pipeline comercial, historial de notas, proyectos asociados y actualizaciones.

### `/proyectos/[id]`
Kanban de tareas por proyecto con cliente asociado, estados y seguimiento.

### `/herramientas`
Biblioteca interna: credenciales, prompts, documentación técnica.

### `/vps`
Dashboard DevOps: estado de proyectos en el VPS, deploys, logs, pausar/reanudar/reiniciar servicios vía API.

### `/crypto-intel`
Inteligencia de mercado crypto: precios en tiempo real, sistema de alertas configurables (precio umbral, cambio porcentual), notificaciones por Telegram y email, admin panel, bot Telegram.

### `/portal` · `/[slug]/dashboard`
Portal público para clientes. Acceso por OTP (código de 6 dígitos enviado por email). Los clientes ven el estado de sus proyectos y actualizaciones sin necesidad de cuenta.

### `/login`
Autenticación con NextAuth v5 (credenciales). Soporta redirect tras login.

---

## Navegación

La navegación usa un **Command Palette** estilo Linear/Raycast como método principal en todos los viewports.

- **Desktop:** `⌘K` / `Ctrl+K` — fuzzy search para navegar secciones, buscar clientes, proyectos, tareas y VPS
- **Mobile:** botón **⊞ Menú** en el header (esquina superior derecha)
- **Sidebar:** visible solo en pantallas ≥ 1280px como atajo visual con labels

El palette incluye secciones: **Navegar**, **Recientes** (localStorage), resultados CRM en tiempo real.

---

## Arquitectura de componentes

```
src/
├── app/
│   ├── (admin)/          — rutas protegidas (auth requerida)
│   │   ├── layout.tsx    — shell principal + providers
│   │   ├── dashboard/
│   │   ├── hoy/
│   │   ├── clientes/
│   │   ├── herramientas/
│   │   ├── vps/
│   │   └── crypto-intel/
│   ├── [slug]/           — portal de clientes (público)
│   ├── portal/           — login OTP del portal
│   └── api/              — endpoints REST
├── components/
│   ├── nav/
│   │   ├── command-palette.tsx       — palette principal (Radix Dialog + cmdk)
│   │   ├── command-palette-items.ts  — catálogo de navegación + recientes
│   │   ├── global-header.tsx         — header persistente
│   │   └── desktop-sidebar.tsx       — sidebar ≥1280px
│   ├── cmd-k/
│   │   └── CmdKProvider.tsx          — estado global del palette + ⌘K
│   ├── crm/              — CRM shell, contexto, vistas
│   └── crypto-intel/     — alertas, market pulse, admin
├── lib/
│   ├── crypto-intel/     — server actions, schemas, evaluador de alertas
│   └── vps-swr.ts
└── middleware.ts
```

---

## API Routes

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/session` | `POST / DELETE` | Crear / revocar sesión cookie |
| `/api/health` | `GET` | Health check |
| `/api/vps/status` | `GET` | Estado del VPS |
| `/api/vps/projects` | `GET` | Lista de proyectos en VPS |
| `/api/vps/deploy` | `POST` | Disparar deploy (body: `{ projectId }`) |
| `/api/vps/logs` | `GET` | Logs de un proyecto |
| `/api/vps/pause` | `POST` | Pausar proyecto |
| `/api/vps/resume` | `POST` | Reanudar proyecto |
| `/api/vps/restart` | `POST` | Reiniciar proyecto |
| `/api/crypto-intel/prices/sync` | `POST` | Sincronizar precios de mercado |
| `/api/crypto-intel/alerts/evaluate` | `POST` | Evaluar y disparar alertas |
| `/api/crypto-intel/telegram/webhook` | `POST` | Webhook del bot Telegram |
| `/api/notifications/send` | `POST` | Enviar notificación |
| `/api/notifications/daily` | `POST` | Resumen diario |
| `/api/notifications/charges` | `POST` | Notificación de cobro |
| `/api/send-email` | `POST` | Envío de email transaccional |

---

## Datos — PostgreSQL

Todas las tablas viven en `src/lib/db/schema.ts` (Drizzle). Las columnas
`firestore_id` son el vinculo historico de las filas migradas desde Firestore
y sostienen los ids publicos; se conservan a proposito.

---

## Seguridad

- **Middleware:** protege rutas con la sesion de NextAuth; sesiones invalidas redirigen a `/login`.
- **Server Actions:** todas las acciones verifican `getSessionUserId()` (identidad canonica `users.id`). Ownership checks para prevenir IDOR.

---

## Variables de entorno

### Build-time (públicas, inyectadas vía Docker ARG)
```
NEXT_PUBLIC_LOGO_URL
NEXT_PUBLIC_PROFILE_PHOTO_URL
```

### Runtime (`.env.production`, nunca en el repo)
```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
CRON_SECRET
VPS_API_URL
VPS_API_KEY
```

---

## Infraestructura

```
OVH VPS
├── pixeltec-infra/         — Nginx + Certbot (red: web-network)
│   └── docker-compose.yml
└── pixeltec-os/            — Esta app
    └── docker-compose.yml  — container: pixeltec-os, puerto interno 3000
```

Nginx hace proxy de `pixeltec.mx → app:3000` por la red Docker `web-network`.

---

## Operaciones comunes

> **Deploy a producción (E0g-3, ADR-0028):** SOLO por el workflow manual
> `Deploy PixelTEC OS (manual)` (`workflow_dispatch` + aprobación del
> Environment `production`). Requiere SHA completo (ancestro de `origin/main`)
> y valida el contrato E0 (`npm run validate:egress -- --profile=predeploy`)
> ANTES de construir; capabilities (`--require-r2-delete`, etc.) solo por
> inputs aprobados. Imágenes etiquetadas por SHA (`pixeltec-os-app:<sha>`);
> `latest` se mueve tras health OK; rollback automático a la versión previa
> (`.deploy-active-sha`) ante health FAIL. Sin `git pull` ni `docker image
> prune` en el flujo (la limpieza conserva ≥2 versiones y es un gate aparte).
> Los smokes con efectos reales (email, WhatsApp, IA, R2 delete) son manuales
> y posteriores. Detalle: `scripts/deploy/production-deploy.sh`.
>
> **`deploy.sh` (raíz) está RETIRADO y siempre falla** — no es una ruta
> alternativa de despliegue (hacía `git add .` + commit + push + pull + build
> sin gobierno). El único despliegue autorizado es el workflow manual descrito
> arriba: SHA completo, Environment `production` y credencial de deploy nueva;
> la llave antigua de GitHub Actions continúa deshabilitada.

```bash
# Rebuild manual de emergencia (preferir SIEMPRE el workflow de deploy)
docker compose build --no-cache app && docker compose up -d app

# Ver logs en vivo
docker compose logs -f app

# Reiniciar sin rebuild
docker compose restart app

# Verificar BUILD_ID en producción
docker compose exec app cat .next/BUILD_ID
```

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar variables locales
npm run dev                         # http://localhost:3000
```
