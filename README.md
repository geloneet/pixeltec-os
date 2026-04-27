# PixelTEC OS

Sistema operativo interno de PixelTEC — CRM, gestión de proyectos, DevOps, inteligencia crypto y portal de clientes, todo en una sola aplicación.

**Producción:** https://pixeltec.mx

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, standalone output) |
| UI | Tailwind CSS, shadcn/ui, Radix UI, Lucide React |
| Auth | Firebase Auth + sesión cookie (`__session`) verificada con Firebase Admin SDK |
| Base de datos | Firestore (cliente SDK en browser, Admin SDK en server) |
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
Autenticación con Firebase. Soporta redirect tras login. Verifica sesión cookie en middleware.

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
│   ├── firebase-admin.ts
│   ├── crypto-intel/     — server actions, schemas, evaluador de alertas
│   └── vps-swr.ts
└── middleware.ts         — verifica __session cookie con Firebase Admin SDK
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

## Firestore — colecciones

| Colección | Acceso | Descripción |
|---|---|---|
| `users/{uid}` | Solo el propio usuario | Perfil y rol |
| `clients/{id}` | Auth (write) / Público (read) | Clientes + pipeline |
| `clients/{id}/updates` | Auth (write) / Público (read) | Actualizaciones de cliente |
| `clients/{id}/projects` | Auth (write) / Público (read) | Proyectos del cliente |
| `leads`, `tickets`, `finances`, `tasks`, `activity` | Auth | Datos del CRM |
| `crm_data/{uid}` | Solo el propio usuario autenticado | Estado blob del CRM |
| `alertRules`, `alerts`, `prices`, `priceSnapshots`, `cryptoIntelLogs`, `telegramUsers`, `telegramSessions` | **Solo Admin SDK** (denegado al cliente) | Crypto intel — solo backend |

---

## Seguridad

- **Middleware:** verifica criptográficamente la cookie `__session` con `verifySessionCookie()` en cada request a rutas protegidas. Cookies inválidas/expiradas → redirect a `/login?error=session_expired`. Errores de infraestructura → fail-open.
- **Firestore Rules:** colecciones crypto-intel denegadas explícitamente al cliente (`if false`). Datos de otros usuarios inaccesibles.
- **Server Actions:** todas las acciones verifican `getSessionUid()`. Ownership checks en alertas para prevenir IDOR.

---

## Variables de entorno

### Build-time (públicas, inyectadas vía Docker ARG)
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

### Runtime (`.env.production`, nunca en el repo)
```
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
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

```bash
# Rebuild y deploy completo
docker compose build --no-cache app && docker compose up -d app

# Ver logs en vivo
docker compose logs -f app

# Reiniciar sin rebuild
docker compose restart app

# Verificar BUILD_ID en producción
docker compose exec app cat .next/BUILD_ID

# Aplicar Firestore rules
firebase deploy --only firestore:rules
```

---

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar con credenciales Firebase
npm run dev                         # http://localhost:3000
```

> El middleware usa `firebase-admin` con `nodeMiddleware: true` (Next.js 15.2+). No funciona en Edge runtime — requiere Node.js runtime explícito (`export const runtime = 'nodejs'`).
