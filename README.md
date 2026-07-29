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

> **Deploy a producción (M1A — deploy manual gobernado desde el VPS):**
> **GitHub Actions está RETIRADO como camino productivo** (el workflow
> `deploy.yml` fue eliminado; PROHIBIDO restaurar un pipeline de deploy desde
> Actions — GitHub queda solo como `origin`, fuente del SHA aprobado, respaldo
> y CI no productivo futuro). El ÚNICO camino autorizado es el comando
> instalado en el VPS (plantilla versionada:
> `scripts/deploy/deploy-pixeltec-os-wrapper.sh`, instalada como
> `/usr/local/sbin/deploy-pixeltec-os`, root:root 0755, ejecutada como
> `ubuntu`):
>
> ```bash
> # SIEMPRE dentro de tmux (el build tarda >30 min y no debe morir con el SSH)
> tmux new -s deploy-pixeltec
> deploy-pixeltec-os --sha <40-hex> [--require-r2-delete] \
>   [--require-meta-credential-read] [--require-meta-publish] [--check-only]
> ```
>
> Requiere SHA completo (ancestro de `origin/main`); `--check-only` ejecuta
> todas las validaciones (SHA, release, compose config, contrato E0) sin
> build ni activación. El motor (`scripts/deploy/production-deploy.sh`, se
> extrae DEL SHA aprobado) valida el contrato E0 ANTES de construir;
> capabilities solo explícitas (mínimo privilegio). Construye desde una
> **release inmutable** (`git archive` → `/home/ubuntu/pixeltec-os-releases/<sha>`):
> el checkout canónico **NUNCA se muta** — sin `git pull` y sin
> `git checkout/switch/reset` sobre `/home/ubuntu/pixeltec-os`. Imágenes
> etiquetadas por SHA (`pixeltec-os-app:<sha>`); `latest` se mueve tras health
> OK; rollback automático a la versión previa (`.deploy-active-sha`) ante
> health FAIL; la imagen fallida se conserva para diagnóstico. Sin `docker
> image prune` ni `docker system prune` automáticos en el flujo (la limpieza
> conserva ≥2 versiones y es un gate aparte). Un lock (`flock`) impide deploys
> concurrentes. Evidencia en `/home/ubuntu/deploy-logs/`. Los smokes con
> efectos reales (email, WhatsApp, IA, R2 delete) son manuales y posteriores.
>
> **`deploy.sh` (raíz) está RETIRADO y siempre falla** — no es una ruta
> alternativa de despliegue (hacía `git add .` + commit + push + pull + build
> sin gobierno). La llave SSH de GitHub Actions y el secret
> `VPS_DEPLOY_SSH_KEY` quedan programados para eliminación tras validar el
> deploy manual (gate M1B).
>
> **qa-runner:** el deploy normal reconstruye ÚNICAMENTE `app`. `qa-runner` es
> una imagen separada (mismo Dockerfile, target propio), **sin bind mount del
> checkout** (rootfs read-only + tmpfs): no se recrea ni se modifica en un
> deploy (`--no-deps`). Cambios futuros a qa-runner requieren su propio gate y
> comando explícito. B7 no lo toca.

```bash
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
