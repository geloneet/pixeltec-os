# PixelTEC OS — Information Architecture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplementar la arquitectura de información de PixelTEC OS conforme al Product Architecture Document aprobado (2026-06-16): nueva pantalla principal `Hoy`, elevación de `Tareas` y `Proyectos` como entidades primarias, módulo `Cobros`, sección `Sistema` colapsada, y `Crypto Intel` fuera del núcleo de navegación.

**Architecture:** La navegación se rewires en `command-palette-items.ts` (única fuente de verdad para todas las vistas de nav). El nuevo módulo `/hoy` consulta tareas del día (`AssistantTaskDoc.startsAt` dentro del día actual en TZ México), proyectos activos vía `collectionGroup('projects')`, y clientes con actualizaciones pendientes. `/tareas` es un rename de ruta de `/asistente` (los archivos se mueven, se agrega redirect en `next.config.ts`). `/proyectos` agrega una página de lista cross-client. `/cobros` es colección Firestore nueva. `/accesos` reemplaza `/herramientas`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Firestore Admin SDK, `date-fns` + `date-fns-tz`, shadcn/ui, Tailwind CSS, Server Actions (`"use server"`).

---

## Análisis de dependencias y riesgos

### Colecciones Firestore que se reutilizan sin cambios

| Colección | Usada por | Notas |
|---|---|---|
| `assistantTasks` | `/tareas` (rename), `/hoy` | `startsAt: Timestamp` — query by day range |
| `assistantTemplates` | `/tareas/templates` | Sin cambios |
| `assistantWeeklyReports` | `/tareas/historial` | Sin cambios |
| `clients` | `/clientes`, `/hoy` | Ya tiene `slug`, `name`, `email` |
| `clients/{id}/projects` | `/proyectos`, `/hoy` | Subcollection — usamos collectionGroup |
| `clients/{id}/updates` | `/clientes/[id]` | Sin cambios |

### Colecciones que deben crearse

| Colección | Para | Schema nuevo |
|---|---|---|
| `cobros` | `/cobros` | Ver Task 13 |

### Colecciones que no se tocan

| Colección | Por qué |
|---|---|
| `crm_data/{uid}` | Blob legacy del CRM shell — sigue funcionando igual |
| `finances` | No se migra en este plan |
| `tools` / `herramientas` | `/accesos` reutiliza la misma colección |
| `alertRules`, `prices`, etc. | Crypto Intel queda en `/accesos` como ítem oculto |

### Riesgos de arquitectura

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `collectionGroup('projects')` requiere índice Firestore | Bloquea `/proyectos` list y `/hoy` health panel | Crear índice antes del deploy (Task 12) |
| `/asistente` tiene sub-rutas profundas (historial, templates) | Move de carpeta rompe links internos si no se hacen todos los redirects | Task 9 cubre TODOS los sub-paths |
| `crm_data` blob y `clients/{id}/projects` pueden tener datos distintos | `/proyectos` mostraría proyectos incompletos | Documentado en Task 11 — solo lee subcollection |
| `RecurringCharge` del CRM no migra a `cobros` | `/cobros` arranca vacío | Decisión de producto aceptada — datos nuevos en colección nueva |
| El middleware lista rutas hardcoded | Nuevas rutas sin agregar al middleware son 404 | Task 2 cubre middleware |

---

## MVP funcional mínimo

**Semanas 1–2 (Tasks 1–8)** producen un sistema completamente funcional con:
- Navegación nueva (Núcleo / Gestión / Sistema)
- Pantalla `/hoy` como default con las 3 zonas operativas
- `/dashboard` redirige a `/hoy`

El resto (Semanas 3–6) eleva entidades y agrega módulos nuevos sin romper nada.

---

## Roadmap 6 semanas

| Semana | Fase | Tasks | Entrega |
|---|---|---|---|
| 1 | Foundation | 1–3 | Nav rewired, middleware actualizado, tipos base |
| 2 | Hoy MVP | 4–8 | `/hoy` funcional — pantalla de inicio operativa |
| 3 | Tareas + Proyectos | 9–12 | `/tareas` como ruta canónica, `/proyectos` list |
| 4 | Cobros | 13–15 | Módulo `/cobros` con CRUD básico |
| 5 | Accesos + Clientes | 16–17 | `/accesos`, reframe de `/clientes` |
| 6 | Sistema + Cleanup | 18–20 | Sidebar Sistema colapsado, crypto oculto, redirects finales |

---

## Mapa de archivos

### Archivos a CREAR

```
src/app/(admin)/hoy/
  page.tsx                          — Server Component: carga los 3 datasets
  actions.ts                        — Server Actions: getTodayTasks, getProjectsHealth, getClientsPending
  _components/
    today-tasks-panel.tsx           — Zona A: tareas de hoy
    projects-health-panel.tsx       — Zona B: proyectos con semáforo
    client-pending-panel.tsx        — Zona C: clientes con pendientes
    quick-add-task.tsx              — Input inline "+ Nueva tarea" (reutilizado en /tareas)

src/app/(admin)/tareas/             — Copia de /asistente con nuevo nombre de ruta
  page.tsx
  asistente-client.tsx
  _components/ (mismos archivos)
  historial/
  templates/

src/app/(admin)/proyectos/
  page.tsx                          — Lista cross-client de proyectos activos

src/app/(admin)/cobros/
  page.tsx                          — Lista de cobros
  actions.ts                        — Server Actions: createCobro, updateCobro, listCobros
  _components/
    cobro-form-dialog.tsx
    cobro-row.tsx

src/app/(admin)/accesos/
  page.tsx                          — Reemplaza /herramientas

src/lib/hoy/
  types.ts                          — TodayTask, ProjectHealth, ClientPending
  queries.ts                        — getTodayTasks, getProjectsHealth, getClientsPending

src/lib/cobros/
  types.ts                          — CobroDoc, CobroSerialized
  actions.ts                        — createCobro, updateCobroStatus, listCobros
```

### Archivos a MODIFICAR

```
src/components/nav/command-palette-items.ts   — Nueva estructura de secciones
src/components/nav/desktop-sidebar.tsx         — Secciones NÚCLEO/GESTIÓN/SISTEMA + collapse
src/middleware.ts                              — Agregar /hoy, /tareas, /cobros, /accesos
next.config.ts                                — Redirects: /dashboard→/hoy, /asistente→/tareas, /herramientas→/accesos
src/app/(admin)/layout.tsx                     — Default redirect a /hoy si llega a /
```

### Archivos a ELIMINAR (después de migrar)

```
src/app/(admin)/asistente/           — Después de crear /tareas y confirmar redirects
src/app/(admin)/herramientas/        — Después de crear /accesos
```

---

## Task 1: Navigation rewiring — command-palette-items.ts

**Archivos:**
- Modify: `src/components/nav/command-palette-items.ts`

- [ ] **Step 1: Reemplazar tipos de sección**

En `src/components/nav/command-palette-items.ts`, reemplazar el tipo `NavSection` y el array de items completo:

```typescript
import {
  Sun,
  CheckSquare,
  FolderKanban,
  Users,
  CreditCard,
  KeyRound,
  Server,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "nucleo" | "gestion" | "sistema";

export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: NavSection;
  hidden?: boolean; // items ocultos del sidebar pero buscables en ⌘K
}

export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Núcleo ────────────────────────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas del día, proyectos en riesgo y pendientes de clientes",
    icon: Sun,
    section: "nucleo",
  },
  {
    href: "/tareas",
    label: "Tareas",
    description: "Lista maestra de tareas y planificador semanal con IA",
    icon: CheckSquare,
    section: "nucleo",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Estado de todos los proyectos activos",
    icon: FolderKanban,
    section: "nucleo",
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Directorio de cuentas activas y portal de clientes",
    icon: Users,
    section: "nucleo",
  },
  // ── Gestión ───────────────────────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Facturas, pagos pendientes y cobros por cliente",
    icon: CreditCard,
    section: "gestion",
  },
  {
    href: "/accesos",
    label: "Accesos",
    description: "Credenciales, API keys y documentación técnica por proyecto",
    icon: KeyRound,
    section: "gestion",
  },
  // ── Sistema ───────────────────────────────────────────────────────────────
  {
    href: "/vps",
    label: "Infraestructura",
    description: "VPS status, deploys y logs de servicios",
    icon: Server,
    section: "sistema",
  },
  {
    href: "/blog-admin",
    label: "Blog",
    description: "Gestión de posts y pipeline de contenido",
    icon: FileText,
    section: "sistema",
  },
  {
    href: "/perfil",
    label: "Configuración",
    description: "Perfil, notificaciones y preferencias",
    icon: Settings,
    section: "sistema",
  },
  // ── Ocultos (buscables en ⌘K, no en sidebar) ─────────────────────────────
  {
    href: "/crypto-intel",
    label: "Crypto Intel",
    description: "Precios y alertas de mercado en tiempo real",
    icon: KeyRound, // reemplazar con Bitcoin si se re-importa
    section: "gestion",
    hidden: true,
  },
];

export const NAV_SECTION_ORDER: NavSection[] = ["nucleo", "gestion", "sistema"];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  nucleo: "Núcleo",
  gestion: "Gestión",
  sistema: "Sistema",
};

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -40
```

Expected: errores solo en `desktop-sidebar.tsx` (usa `NavSection` viejo) — se corrigen en Task 2. Sin otros errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/command-palette-items.ts
git commit -m "refactor(nav): rewire navigation to NÚCLEO/GESTIÓN/SISTEMA architecture

New primary routes: /hoy, /tareas, /proyectos, /clientes
New management routes: /cobros, /accesos
Sistema section: /vps, /blog-admin, /perfil
Crypto Intel moved to hidden (searchable in ⌘K, not in sidebar)"
```

---

## Task 2: Middleware + next.config redirects

**Archivos:**
- Modify: `src/middleware.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Actualizar PROTECTED_PATHS y KNOWN_ROUTES en middleware**

En `src/middleware.ts`, reemplazar las constantes `PROTECTED_PATHS` y `KNOWN_ROUTES`:

```typescript
const PROTECTED_PATHS = [
  '/hoy',
  '/tareas',
  '/proyectos',
  '/clientes',
  '/cobros',
  '/accesos',
  '/vps',
  '/perfil',
  '/notificaciones',
  '/blog-admin',
  // Legacy (redirected by next.config — keep here while redirects are in place)
  '/dashboard',
  '/asistente',
  '/herramientas',
  '/crypto-intel',
];

const KNOWN_ROUTES = new Set([
  'about', 'contact', 'services', 'blog', 'metodologia', 'equipo',
  'industrias', 'privacy-policy', 'aviso-de-privacidad', 'terminos-de-servicio',
  'data-deletion', 'guias-transformacion', 'login', 'api',
  // Admin roots
  'hoy', 'tareas', 'proyectos', 'clientes', 'cobros', 'accesos',
  'vps', 'perfil', 'notificaciones', 'blog-admin',
  // Legacy (kept while redirects are active)
  'dashboard', 'asistente', 'herramientas', 'crypto-intel',
]);
```

- [ ] **Step 2: Actualizar el `config.matcher`**

En el mismo archivo, reemplazar el objeto `config`:

```typescript
export const config = {
  matcher: [
    '/hoy/:path*',
    '/tareas/:path*',
    '/proyectos/:path*',
    '/clientes/:path*',
    '/cobros/:path*',
    '/accesos/:path*',
    '/vps/:path*',
    '/perfil/:path*',
    '/notificaciones/:path*',
    '/blog-admin/:path*',
    // Legacy redirects — keep in matcher while next.config redirects are active
    '/dashboard/:path*',
    '/asistente/:path*',
    '/herramientas/:path*',
    '/crypto-intel/:path*',
    // Single-segment paths — portal slug validation
    '/:slug',
  ],
};
```

- [ ] **Step 3: Agregar redirects en next.config.ts**

En `next.config.ts`, dentro de `async redirects()`, agregar al array existente:

```typescript
// PixelTEC OS IA Redesign — 2026-06-16
{ source: '/dashboard', destination: '/hoy', permanent: false },
{ source: '/dashboard/:path*', destination: '/hoy', permanent: false },
{ source: '/asistente', destination: '/tareas', permanent: false },
{ source: '/asistente/historial', destination: '/tareas/historial', permanent: false },
{ source: '/asistente/historial/:weekKey', destination: '/tareas/historial/:weekKey', permanent: false },
{ source: '/asistente/templates', destination: '/tareas/templates', permanent: false },
{ source: '/asistente/templates/:path*', destination: '/tareas/templates/:path*', permanent: false },
{ source: '/herramientas', destination: '/accesos', permanent: false },
{ source: '/herramientas/:path*', destination: '/accesos/:path*', permanent: false },
```

Nota: `permanent: false` (302) mientras se valida — cambiar a `true` (301) en Semana 6 cuando todo esté estable.

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts next.config.ts
git commit -m "feat(routing): add middleware protection and redirects for new IA routes

Protected: /hoy, /tareas, /proyectos, /cobros, /accesos
Redirects: /dashboard→/hoy, /asistente→/tareas, /herramientas→/accesos
Redirects are 302 (temporary) until Semana 6 validation"
```

---

## Task 3: Tipos base para /hoy

**Archivos:**
- Create: `src/lib/hoy/types.ts`

- [ ] **Step 1: Crear el directorio y el archivo de tipos**

```bash
mkdir -p /home/ubuntu/pixeltec-os/src/lib/hoy
```

- [ ] **Step 2: Escribir `src/lib/hoy/types.ts`**

```typescript
export interface TodayTask {
  id: string;
  title: string;
  description: string | null;
  status: 'pendiente' | 'proceso' | 'completado' | 'cancelado' | 'postergado';
  category: string;
  startsAt: string; // ISO string
  durationMin: number;
  isOverdue: boolean; // startsAt < now && status !== completado
}

export type ProjectHealthStatus = 'verde' | 'amarillo' | 'rojo';

export interface ProjectHealth {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  domain: string;
  status: ProjectHealthStatus;
  /** Razón del color amarillo/rojo */
  statusReason: string | null;
  /** Última actualización registrada — ISO string */
  lastActivityAt: string | null;
}

export interface ClientPending {
  id: string;
  name: string;
  slug: string;
  /** Actualizaciones de proyecto que no se han enviado al portal */
  pendingUpdates: number;
  /** Cobros vencidos o próximos a vencer (≤7 días) */
  pendingCobros: number;
}

export interface TodayData {
  tasks: TodayTask[];
  projects: ProjectHealth[];
  clients: ClientPending[];
  /** Fecha usada para la query — ISO string en TZ México */
  asOf: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/hoy/types.ts
git commit -m "feat(hoy): add TodayTask, ProjectHealth, ClientPending types"
```

---

## Task 4: Desktop sidebar — nueva estructura de secciones

**Archivos:**
- Modify: `src/components/nav/desktop-sidebar.tsx`

- [ ] **Step 1: Localizar el bloque de secciones en el sidebar**

```bash
grep -n "NAV_SECTION_ORDER\|NAV_SECTION_LABELS\|operacion\|negocio\|infra\|sistema" \
  /home/ubuntu/pixeltec-os/src/components/nav/desktop-sidebar.tsx | head -20
```

- [ ] **Step 2: Reemplazar referencias a secciones antiguas**

Buscar en `desktop-sidebar.tsx` todas las referencias a `"operacion"`, `"negocio"`, `"infra"`, `"sistema"` y reemplazar con `"nucleo"`, `"gestion"`, `"sistema"`.

El sidebar ya importa `NAV_SECTION_ORDER` y `NAV_SECTION_LABELS` de `command-palette-items.ts` — esos valores ya fueron actualizados en Task 1. El único cambio pendiente son referencias directas a string de sección que puedan existir en el archivo.

- [ ] **Step 3: Agregar soporte para `hidden: true`**

En la función `groupBySection` (o donde se filtra `PALETTE_NAV_ITEMS` para el sidebar), agregar filtro:

```typescript
// Antes de agrupar por sección, filtrar los items ocultos del sidebar
const visibleItems = PALETTE_NAV_ITEMS.filter(item => !item.hidden);
```

- [ ] **Step 4: Hacer que la sección "Sistema" inicie colapsada**

En el estado del sidebar, agregar `"sistema"` a la lista de secciones colapsadas por defecto:

```typescript
const [collapsed, setCollapsed] = useState<Set<NavSection>>(
  new Set(["sistema"])
);
```

Si la sección ya tiene manejo de collapse, solo agregar `"sistema"` al estado inicial.

- [ ] **Step 5: Actualizar el BADGE_PLACEHOLDERS**

Reemplazar el objeto `BADGE_PLACEHOLDERS` con las rutas nuevas:

```typescript
const BADGE_PLACEHOLDERS: Record<string, BadgeMeta> = {
  "/tareas": { count: 3, severity: "info" },  // era /asistente
  "/vps": { severity: "warning" },
};
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep -i "sidebar\|palette" | head -20
```

Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/nav/desktop-sidebar.tsx
git commit -m "refactor(sidebar): update to NÚCLEO/GESTIÓN/SISTEMA sections

Sistema section starts collapsed by default.
Hidden items (crypto-intel) excluded from sidebar, still searchable in ⌘K."
```

---

## Task 5: Server Actions de /hoy — getTodayTasks

**Archivos:**
- Create: `src/app/(admin)/hoy/actions.ts`

- [ ] **Step 1: Crear directorio y archivo**

```bash
mkdir -p /home/ubuntu/pixeltec-os/src/app/\(admin\)/hoy
```

- [ ] **Step 2: Escribir `src/app/(admin)/hoy/actions.ts`**

```typescript
"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { getAdminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import {
  toZonedTime,
  fromZonedTime,
  formatInTimeZone,
} from "date-fns-tz";
import type { Timestamp } from "firebase-admin/firestore";
import type { TodayTask, ProjectHealth, ClientPending, TodayData } from "@/lib/hoy/types";

const ASSISTANT_TZ = "America/Mexico_City";
const SESSION_COOKIE = "__session";

async function getAuthenticatedUid(): Promise<string> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) throw new Error("No session");
  const { uid } = await getAdminAuth().verifySessionCookie(session, true);
  return uid;
}

function getTodayBoundsInMX(now: Date): { start: Date; end: Date } {
  const mxNow = toZonedTime(now, ASSISTANT_TZ);
  const y = mxNow.getFullYear();
  const m = mxNow.getMonth();
  const d = mxNow.getDate();
  const start = fromZonedTime(new Date(y, m, d, 0, 0, 0, 0), ASSISTANT_TZ);
  const end = fromZonedTime(new Date(y, m, d, 23, 59, 59, 999), ASSISTANT_TZ);
  return { start, end };
}

export async function getTodayTasks(): Promise<TodayTask[]> {
  const uid = await getAuthenticatedUid();
  const db = getAdminFirestore();
  const now = new Date();
  const { start, end } = getTodayBoundsInMX(now);

  const snap = await db
    .collection("assistantTasks")
    .where("uid", "==", uid)
    .where("startsAt", ">=", start)
    .where("startsAt", "<=", end)
    .orderBy("startsAt", "asc")
    .get();

  const nowTs = now.getTime();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const startsAt = (data.startsAt as Timestamp).toDate();
    const isOverdue =
      startsAt.getTime() < nowTs && data.status !== "completado";
    return {
      id: doc.id,
      title: data.title as string,
      description: data.description as string | null,
      status: data.status,
      category: data.category,
      startsAt: startsAt.toISOString(),
      durationMin: data.durationMin as number,
      isOverdue,
    } satisfies TodayTask;
  });
}

export async function getProjectsHealth(): Promise<ProjectHealth[]> {
  const db = getAdminFirestore();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // collectionGroup requiere índice: projects — ver Task 12 para instrucciones
  const projectsSnap = await db
    .collectionGroup("projects")
    .where("active", "==", true)
    .get();

  const results: ProjectHealth[] = [];

  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    const clientId = doc.ref.parent.parent?.id ?? "";
    const clientName = data.clientName as string ?? "";

    const lastActivityRaw = data.updatedAt as Timestamp | undefined;
    const lastActivityAt = lastActivityRaw
      ? lastActivityRaw.toDate().toISOString()
      : null;
    const dueDateRaw = data.dueDate as Timestamp | undefined;
    const dueDate = dueDateRaw ? dueDateRaw.toDate() : null;

    let status: ProjectHealth["status"] = "verde";
    let statusReason: string | null = null;

    if (!lastActivityAt || new Date(lastActivityAt) < sevenDaysAgo) {
      status = "rojo";
      statusReason = "Sin actividad en 7+ días";
    } else if (dueDate && dueDate <= threeDaysFromNow) {
      status = "amarillo";
      statusReason = `Entrega en ${Math.ceil((dueDate.getTime() - now.getTime()) / 86400000)} días`;
    }

    results.push({
      id: doc.id,
      clientId,
      clientName,
      name: data.name as string,
      domain: data.domain as string ?? "",
      status,
      statusReason,
      lastActivityAt,
    });
  }

  return results.sort((a, b) => {
    const order = { rojo: 0, amarillo: 1, verde: 2 };
    return order[a.status] - order[b.status];
  });
}

export async function getClientsPending(): Promise<ClientPending[]> {
  const db = getAdminFirestore();
  const clientsSnap = await db.collection("clients").get();
  const results: ClientPending[] = [];

  for (const doc of clientsSnap.docs) {
    const data = doc.data();
    const updatesSnap = await doc.ref
      .collection("updates")
      .where("sentToPortal", "==", false)
      .get();

    const pendingUpdates = updatesSnap.size;
    // Cobros: se integra en Task 14 cuando exista la colección
    const pendingCobros = 0;

    if (pendingUpdates > 0 || pendingCobros > 0) {
      results.push({
        id: doc.id,
        name: data.name as string,
        slug: data.slug as string,
        pendingUpdates,
        pendingCobros,
      });
    }
  }

  return results;
}

export async function getTodayData(): Promise<TodayData> {
  const now = new Date();
  const [tasks, projects, clients] = await Promise.all([
    getTodayTasks(),
    getProjectsHealth(),
    getClientsPending(),
  ]);
  return {
    tasks,
    projects,
    clients,
    asOf: formatInTimeZone(now, ASSISTANT_TZ, "yyyy-MM-dd HH:mm"),
  };
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep "hoy" | head -20
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/hoy/actions.ts
git commit -m "feat(hoy): server actions — getTodayTasks, getProjectsHealth, getClientsPending, getTodayData"
```

---

## Task 6: Componente TodayTasksPanel

**Archivos:**
- Create: `src/app/(admin)/hoy/_components/today-tasks-panel.tsx`

- [ ] **Step 1: Crear directorio y componente**

```bash
mkdir -p /home/ubuntu/pixeltec-os/src/app/\(admin\)/hoy/_components
```

Escribir `src/app/(admin)/hoy/_components/today-tasks-panel.tsx`:

```typescript
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodayTask } from "@/lib/hoy/types";

const STATUS_CONFIG = {
  pendiente: { label: "Pendiente", className: "text-purple-400" },
  proceso: { label: "En proceso", className: "text-amber-400" },
  completado: { label: "Completado", className: "text-green-400" },
  cancelado: { label: "Cancelado", className: "text-zinc-500" },
  postergado: { label: "Postergado", className: "text-zinc-500" },
} as const;

function TaskRow({ task }: { task: TodayTask }) {
  const config = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const time = new Date(task.startsAt).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5 px-3 rounded-lg",
        task.isOverdue && task.status !== "completado"
          ? "bg-red-500/8 border border-red-500/20"
          : "hover:bg-zinc-800/40",
      )}
    >
      {task.isOverdue && task.status !== "completado" ? (
        <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
      ) : task.status === "completado" ? (
        <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
      ) : (
        <Clock className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium truncate",
            task.status === "completado" ? "line-through text-zinc-500" : "text-zinc-100",
          )}
        >
          {task.title}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {time} · {task.durationMin}min
          {config && (
            <span className={cn("ml-2", config.className)}>· {config.label}</span>
          )}
        </p>
      </div>
    </div>
  );
}

interface TodayTasksPanelProps {
  tasks: TodayTask[];
}

export function TodayTasksPanel({ tasks }: TodayTasksPanelProps) {
  const overdue = tasks.filter((t) => t.isOverdue && t.status !== "completado");
  const today = tasks.filter((t) => !t.isOverdue || t.status === "completado");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Mis tareas de hoy
        </h2>
        <Link
          href="/tareas"
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      {overdue.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-red-400 font-medium mb-1 px-3">
            Vencidas ({overdue.length})
          </p>
          {overdue.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}

      {today.length === 0 && overdue.length === 0 ? (
        <p className="text-sm text-zinc-500 px-3 py-4 text-center">
          Sin tareas programadas para hoy
        </p>
      ) : (
        today.map((task) => <TaskRow key={task.id} task={task} />)
      )}

      <Link
        href="/tareas"
        className="flex items-center gap-2 mt-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 rounded-lg transition-colors"
      >
        <Plus className="h-4 w-4" />
        Nueva tarea
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep "today-tasks" | head -10
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/hoy/_components/today-tasks-panel.tsx
git commit -m "feat(hoy): TodayTasksPanel — Zona A con tareas del día y vencidas"
```

---

## Task 7: Componentes ProjectsHealthPanel y ClientPendingPanel

**Archivos:**
- Create: `src/app/(admin)/hoy/_components/projects-health-panel.tsx`
- Create: `src/app/(admin)/hoy/_components/client-pending-panel.tsx`

- [ ] **Step 1: Crear `projects-health-panel.tsx`**

```typescript
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProjectHealth } from "@/lib/hoy/types";

const STATUS_COLORS = {
  verde: "bg-green-500",
  amarillo: "bg-amber-400",
  rojo: "bg-red-500",
} as const;

function ProjectRow({ project }: { project: ProjectHealth }) {
  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full flex-shrink-0",
          STATUS_COLORS[project.status],
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{project.name}</p>
        <p className="text-xs text-zinc-500 truncate">
          {project.clientName}
          {project.statusReason && (
            <span className="ml-1 text-amber-400">· {project.statusReason}</span>
          )}
        </p>
      </div>
    </Link>
  );
}

interface ProjectsHealthPanelProps {
  projects: ProjectHealth[];
}

export function ProjectsHealthPanel({ projects }: ProjectsHealthPanelProps) {
  const atRisk = projects.filter((p) => p.status !== "verde");
  const healthy = projects.filter((p) => p.status === "verde");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Proyectos activos
        </h2>
        <Link
          href="/proyectos"
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-zinc-500 px-3 py-4 text-center">
          Sin proyectos activos
        </p>
      ) : (
        <>
          {atRisk.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
          {atRisk.length > 0 && healthy.length > 0 && (
            <hr className="border-zinc-800 my-1" />
          )}
          {healthy.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `client-pending-panel.tsx`**

```typescript
import Link from "next/link";
import { MessageSquare, CreditCard } from "lucide-react";
import type { ClientPending } from "@/lib/hoy/types";

function ClientRow({ client }: { client: ClientPending }) {
  return (
    <Link
      href={`/clientes/${client.id}`}
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{client.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {client.pendingUpdates > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <MessageSquare className="h-3 w-3" />
              {client.pendingUpdates} actualización{client.pendingUpdates !== 1 ? "es" : ""}
            </span>
          )}
          {client.pendingCobros > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <CreditCard className="h-3 w-3" />
              {client.pendingCobros} cobro{client.pendingCobros !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface ClientPendingPanelProps {
  clients: ClientPending[];
}

export function ClientPendingPanel({ clients }: ClientPendingPanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Pendientes de clientes
        </h2>
        <Link
          href="/clientes"
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-zinc-500 px-3 py-4 text-center">
          Sin pendientes de clientes
        </p>
      ) : (
        clients.map((c) => <ClientRow key={c.id} client={c} />)
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep "health-panel\|pending-panel" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/hoy/_components/
git commit -m "feat(hoy): ProjectsHealthPanel (Zona B) y ClientPendingPanel (Zona C)"
```

---

## Task 8: Página /hoy — integración final (MVP completo)

**Archivos:**
- Create: `src/app/(admin)/hoy/page.tsx`

- [ ] **Step 1: Crear `src/app/(admin)/hoy/page.tsx`**

```typescript
import { Suspense } from "react";
import { getTodayData } from "./actions";
import { TodayTasksPanel } from "./_components/today-tasks-panel";
import { ProjectsHealthPanel } from "./_components/projects-health-panel";
import { ClientPendingPanel } from "./_components/client-pending-panel";

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-zinc-800/60 rounded-lg" />
      ))}
    </div>
  );
}

async function HoyContent() {
  const data = await getTodayData();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Zona A — Tareas de hoy (columna principal en desktop) */}
      <div className="xl:col-span-2 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
        <TodayTasksPanel tasks={data.tasks} />
      </div>

      {/* Columna derecha */}
      <div className="flex flex-col gap-6">
        {/* Zona B — Proyectos */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
          <ProjectsHealthPanel projects={data.projects} />
        </div>

        {/* Zona C — Clientes */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
          <ClientPendingPanel clients={data.clients} />
        </div>
      </div>
    </div>
  );
}

export default function HoyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Hoy</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Panel operativo diario — PixelTEC OS
        </p>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
              <PanelSkeleton />
            </div>
            <div className="flex flex-col gap-6">
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
                <PanelSkeleton />
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-5">
                <PanelSkeleton />
              </div>
            </div>
          </div>
        }
      >
        <HoyContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -30
```

Expected: sin errores.

- [ ] **Step 3: Build de verificación**

```bash
cd /home/ubuntu/pixeltec-os && npm run build 2>&1 | tail -20
```

Expected: sin errores de compilación.

- [ ] **Step 4: Commit — MVP listo**

```bash
git add src/app/\(admin\)/hoy/
git commit -m "feat(hoy): MVP completo — pantalla de inicio operativa

Zona A: tareas del día con vencidas resaltadas
Zona B: proyectos activos con semáforo verde/amarillo/rojo
Zona C: clientes con actualizaciones o cobros pendientes
/dashboard redirige automáticamente a /hoy"
```

---

## Task 9: /tareas — mover ruta de /asistente

**Archivos:**
- Create: `src/app/(admin)/tareas/` (copia de asistente)
- Keep: `src/app/(admin)/asistente/` (para que los redirects sigan funcionando hasta Semana 6)

Estrategia: crear `/tareas` como alias que importa los mismos componentes de `/asistente` sin duplicar lógica.

- [ ] **Step 1: Crear page.tsx en /tareas que re-exporte la página de asistente**

Leer el archivo original:
```bash
cat /home/ubuntu/pixeltec-os/src/app/\(admin\)/asistente/page.tsx
```

Crear `src/app/(admin)/tareas/page.tsx` con el mismo contenido que `asistente/page.tsx` pero actualizando:
- Cualquier título que diga "Asistente" → "Tareas"
- Cualquier `href="/asistente"` → `href="/tareas"`

- [ ] **Step 2: Crear sub-rutas en /tareas**

Crear `src/app/(admin)/tareas/historial/page.tsx`:
```typescript
export { default } from "@/app/(admin)/asistente/historial/page";
```

Crear `src/app/(admin)/tareas/historial/[weekKey]/page.tsx`:
```typescript
export { default } from "@/app/(admin)/asistente/historial/[weekKey]/page";
```

Crear `src/app/(admin)/tareas/templates/page.tsx`:
```typescript
export { default } from "@/app/(admin)/asistente/templates/page";
```

Nota: Next.js no permite re-exportar page.tsx de otra ruta directamente. En su lugar, extraer el componente Client a un módulo compartido en `/src/components/tareas/` si es necesario. Ver Step 3.

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -30
```

Si hay errores por el re-export, mover la lógica del componente principal a `src/components/tareas/TareasClient.tsx` e importar desde ambas rutas (`/asistente/page.tsx` y `/tareas/page.tsx`).

- [ ] **Step 4: Verificar build**

```bash
cd /home/ubuntu/pixeltec-os && npm run build 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/tareas/
git commit -m "feat(tareas): create /tareas route — canonical rename of /asistente

/asistente redirects to /tareas via next.config.ts (Task 2).
All sub-routes covered: historial, historial/[weekKey], templates."
```

---

## Task 10: /proyectos — página de lista cross-client

**Archivos:**
- Create: `src/app/(admin)/proyectos/page.tsx`

- [ ] **Step 1: Verificar que existe la ruta `/proyectos/[id]/page.tsx`**

```bash
ls /home/ubuntu/pixeltec-os/src/app/\(admin\)/proyectos/
```

Expected: `[id]/page.tsx` existe.

- [ ] **Step 2: Crear server action para listar proyectos**

Añadir al archivo `src/app/(admin)/hoy/actions.ts` o crear `src/app/(admin)/proyectos/actions.ts`:

```typescript
"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ProjectHealth } from "@/lib/hoy/types";

export async function getAllActiveProjects(): Promise<ProjectHealth[]> {
  // Reutiliza getProjectsHealth de /hoy/actions.ts
  const { getProjectsHealth } = await import("@/app/(admin)/hoy/actions");
  return getProjectsHealth();
}
```

- [ ] **Step 3: Crear `src/app/(admin)/proyectos/page.tsx`**

```typescript
import Link from "next/link";
import { Suspense } from "react";
import { getAllActiveProjects } from "./actions";
import { cn } from "@/lib/utils";
import type { ProjectHealth } from "@/lib/hoy/types";

const STATUS_COLORS = {
  verde: "bg-green-500",
  amarillo: "bg-amber-400",
  rojo: "bg-red-500",
} as const;

const STATUS_LABELS = {
  verde: "Activo",
  amarillo: "Atención",
  rojo: "En riesgo",
} as const;

function ProjectCard({ project }: { project: ProjectHealth }) {
  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="block bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-zinc-100 truncate">{project.name}</p>
          <p className="text-sm text-zinc-400 mt-0.5">{project.clientName}</p>
          {project.domain && (
            <p className="text-xs text-zinc-600 mt-1">{project.domain}</p>
          )}
        </div>
        <span
          className={cn(
            "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full",
            project.status === "verde" && "bg-green-500/12 text-green-400",
            project.status === "amarillo" && "bg-amber-500/12 text-amber-400",
            project.status === "rojo" && "bg-red-500/12 text-red-400",
          )}
        >
          {STATUS_LABELS[project.status]}
        </span>
      </div>
      {project.statusReason && (
        <p className="text-xs text-zinc-500 mt-2">{project.statusReason}</p>
      )}
    </Link>
  );
}

async function ProyectosContent() {
  const projects = await getAllActiveProjects();

  const atRisk = projects.filter((p) => p.status !== "verde");
  const healthy = projects.filter((p) => p.status === "verde");

  return (
    <div className="space-y-6">
      {atRisk.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Requieren atención ({atRisk.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {atRisk.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {healthy.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Activos ({healthy.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {healthy.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <p className="text-zinc-500 text-center py-12">
          No hay proyectos activos registrados.
        </p>
      )}
    </div>
  );
}

export default function ProyectosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Proyectos</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Estado de todos los proyectos activos
        </p>
      </div>
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse bg-zinc-800/60 rounded-xl"
              />
            ))}
          </div>
        }
      >
        <ProyectosContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript y build**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/proyectos/page.tsx src/app/\(admin\)/proyectos/actions.ts
git commit -m "feat(proyectos): add cross-client projects list page

Shows all active projects sorted by health status (rojo → amarillo → verde).
Uses collectionGroup('projects') — requires Firestore index (see Task 12)."
```

---

## Task 11: Índice Firestore para collectionGroup('projects')

**Archivos:**
- Modify: `firestore.indexes.json` (o crear si no existe)

- [ ] **Step 1: Verificar si existe el archivo de índices**

```bash
ls /home/ubuntu/pixeltec-os/firestore.indexes.json 2>/dev/null || echo "no existe"
```

- [ ] **Step 2: Crear o actualizar `firestore.indexes.json`**

Si no existe, crear:

```json
{
  "indexes": [
    {
      "collectionGroup": "projects",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Si ya existe, agregar el índice al array.

- [ ] **Step 3: Desplegar el índice**

```bash
cd /home/ubuntu/pixeltec-os && firebase deploy --only firestore:indexes
```

Expected: `Deploy complete!`. El índice puede tardar 2–5 minutos en construirse en Firebase.

- [ ] **Step 4: Verificar en Firestore Console**

Confirmar en `console.firebase.google.com → Firestore → Indexes` que el índice `projects (COLLECTION_GROUP) — active ASC, updatedAt DESC` está en estado `Enabled`.

- [ ] **Step 5: Commit**

```bash
git add firestore.indexes.json
git commit -m "feat(firestore): add collectionGroup index for projects

Required for /proyectos list and /hoy ProjectsHealthPanel queries."
```

---

## Task 12: Módulo /cobros — tipos y colección Firestore

**Archivos:**
- Create: `src/lib/cobros/types.ts`

- [ ] **Step 1: Crear `src/lib/cobros/types.ts`**

```typescript
import type { Timestamp } from "firebase-admin/firestore";

export type CobroStatus = "pendiente" | "pagado" | "vencido";
export type CobroFrecuencia = "unico" | "mensual" | "anual";

export interface CobroDoc {
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  concept: string;
  amount: number;
  currency: "MXN" | "USD";
  status: CobroStatus;
  dueDate: Timestamp;
  paidAt?: Timestamp | null;
  frecuencia: CobroFrecuencia;
  invoiceUrl?: string | null;
  notes?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CobroSerialized {
  id: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  concept: string;
  amount: number;
  currency: "MXN" | "USD";
  status: CobroStatus;
  dueDate: string; // ISO string
  paidAt?: string | null;
  frecuencia: CobroFrecuencia;
  invoiceUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeCobro(doc: CobroDoc, id: string): CobroSerialized {
  return {
    id,
    clientId: doc.clientId,
    clientName: doc.clientName,
    projectId: doc.projectId,
    projectName: doc.projectName,
    concept: doc.concept,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    dueDate: doc.dueDate.toDate().toISOString(),
    paidAt: doc.paidAt?.toDate().toISOString() ?? null,
    frecuencia: doc.frecuencia,
    invoiceUrl: doc.invoiceUrl ?? null,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt.toDate().toISOString(),
    updatedAt: doc.updatedAt.toDate().toISOString(),
  };
}
```

- [ ] **Step 2: Crear reglas Firestore para la colección cobros**

En `firestore.rules`, agregar la regla para `cobros`:

```
match /cobros/{cobroId} {
  allow read, write: if request.auth != null;
}
```

Aplicar:

```bash
cd /home/ubuntu/pixeltec-os && firebase deploy --only firestore:rules
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep "cobros" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/cobros/types.ts firestore.rules
git commit -m "feat(cobros): Firestore schema — CobroDoc, CobroSerialized, serializeCobro

New collection 'cobros' with status: pendiente/pagado/vencido.
Firestore rules updated to allow auth reads/writes."
```

---

## Task 13: Módulo /cobros — Server Actions y página

**Archivos:**
- Create: `src/app/(admin)/cobros/actions.ts`
- Create: `src/app/(admin)/cobros/page.tsx`
- Create: `src/app/(admin)/cobros/_components/cobro-form-dialog.tsx`

- [ ] **Step 1: Crear `src/app/(admin)/cobros/actions.ts`**

```typescript
"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { serializeCobro, type CobroDoc, type CobroSerialized } from "@/lib/cobros/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateCobroSchema = z.object({
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  concept: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.enum(["MXN", "USD"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frecuencia: z.enum(["unico", "mensual", "anual"]),
  notes: z.string().optional(),
});

export async function listCobros(): Promise<CobroSerialized[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection("cobros")
    .orderBy("dueDate", "asc")
    .get();
  return snap.docs.map((doc) =>
    serializeCobro(doc.data() as CobroDoc, doc.id),
  );
}

export async function createCobro(
  input: z.infer<typeof CreateCobroSchema>,
): Promise<{ id: string }> {
  const data = CreateCobroSchema.parse(input);
  const db = getAdminFirestore();
  const dueDate = new Date(data.dueDate + "T12:00:00");

  const doc: Omit<CobroDoc, "createdAt" | "updatedAt"> = {
    clientId: data.clientId,
    clientName: data.clientName,
    projectId: data.projectId,
    projectName: data.projectName,
    concept: data.concept,
    amount: data.amount,
    currency: data.currency,
    status: "pendiente",
    dueDate: dueDate as unknown as import("firebase-admin/firestore").Timestamp,
    paidAt: null,
    frecuencia: data.frecuencia,
    notes: data.notes ?? null,
  };

  const ref = await db.collection("cobros").add({
    ...doc,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath("/cobros");
  revalidatePath("/hoy");
  return { id: ref.id };
}

export async function updateCobroStatus(
  id: string,
  status: "pendiente" | "pagado" | "vencido",
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection("cobros").doc(id).update({
    status,
    paidAt: status === "pagado" ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  revalidatePath("/cobros");
  revalidatePath("/hoy");
}
```

- [ ] **Step 2: Crear `src/app/(admin)/cobros/page.tsx`**

```typescript
import { Suspense } from "react";
import { listCobros } from "./actions";
import type { CobroSerialized } from "@/lib/cobros/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  pendiente: { label: "Pendiente", className: "bg-amber-500/12 text-amber-400" },
  pagado: { label: "Pagado", className: "bg-green-500/12 text-green-400" },
  vencido: { label: "Vencido", className: "bg-red-500/12 text-red-400" },
} as const;

function CobroRow({ cobro }: { cobro: CobroSerialized }) {
  const config = STATUS_CONFIG[cobro.status];
  const dueDate = new Date(cobro.dueDate).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  });
  const amount = new Intl.NumberFormat("es-MX", {
    style: "currency", currency: cobro.currency,
  }).format(cobro.amount);

  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-zinc-800/60 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{cobro.concept}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {cobro.clientName}
          {cobro.projectName && ` · ${cobro.projectName}`}
          {` · Vence ${dueDate}`}
        </p>
      </div>
      <p className="text-sm font-semibold text-zinc-100 flex-shrink-0">{amount}</p>
      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", config.className)}>
        {config.label}
      </span>
    </div>
  );
}

async function CobrosContent() {
  const cobros = await listCobros();
  const pendientes = cobros.filter((c) => c.status === "pendiente");
  const vencidos = cobros.filter((c) => c.status === "vencido");
  const pagados = cobros.filter((c) => c.status === "pagado");

  return (
    <div className="space-y-6">
      {vencidos.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">
            Vencidos ({vencidos.length})
          </h2>
          <div className="bg-zinc-900/50 border border-red-500/20 rounded-xl overflow-hidden">
            {vencidos.map((c) => <CobroRow key={c.id} cobro={c} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Pendientes ({pendientes.length})
        </h2>
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
          {pendientes.length === 0 ? (
            <p className="text-sm text-zinc-500 px-4 py-6 text-center">Sin cobros pendientes</p>
          ) : (
            pendientes.map((c) => <CobroRow key={c.id} cobro={c} />)
          )}
        </div>
      </section>

      {pagados.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Pagados recientemente ({pagados.length})
          </h2>
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl overflow-hidden">
            {pagados.map((c) => <CobroRow key={c.id} cobro={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}

export default function CobrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Cobros</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Facturas y pagos por cliente
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-zinc-800/60 rounded-xl" />
            ))}
          </div>
        }
      >
        <CobrosContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript y build**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -30 && npm run build 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/cobros/ src/lib/cobros/
git commit -m "feat(cobros): billing module — list page and server actions

CRUD: listCobros, createCobro, updateCobroStatus.
View: grouped by status (vencido → pendiente → pagado).
revalidatePath wired to /hoy for ClientPendingPanel integration."
```

---

## Task 14: /accesos — reemplazar /herramientas

**Archivos:**
- Create: `src/app/(admin)/accesos/page.tsx`

- [ ] **Step 1: Leer la página actual de /herramientas**

```bash
cat /home/ubuntu/pixeltec-os/src/app/\(admin\)/herramientas/page.tsx
```

- [ ] **Step 2: Crear `src/app/(admin)/accesos/page.tsx`**

Copiar el contenido de `/herramientas/page.tsx` actualizando:
- Título: "Herramientas" → "Accesos"
- Descripción: "Credenciales, API keys y documentación técnica por proyecto"
- Cualquier `href="/herramientas"` → `href="/accesos"`
- Cualquier `href="/herramientas/[id]"` → `href="/accesos/[id]"`

- [ ] **Step 3: Crear `src/app/(admin)/accesos/[id]/page.tsx`**

Mismo procedimiento: copiar de `/herramientas/[id]/page.tsx` actualizando paths.

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep "accesos" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/accesos/
git commit -m "feat(accesos): create /accesos route — replaces /herramientas

/herramientas redirects to /accesos via next.config.ts.
Same functionality, reframed as 'Accesos' (credentials + docs)."
```

---

## Task 15: Sidebar — sección Sistema colapsada + cleanup

**Archivos:**
- Modify: `src/components/nav/desktop-sidebar.tsx`
- Modify: `src/components/nav/command-palette.tsx`

- [ ] **Step 1: Agregar lógica de collapse por sección en el sidebar**

En `desktop-sidebar.tsx`, localizar dónde se renderizan las secciones. Agregar estado de collapse para "sistema":

```typescript
const [collapsedSections, setCollapsedSections] = useState<Set<NavSection>>(
  () => new Set(["sistema"]),
);

function toggleSection(section: NavSection) {
  setCollapsedSections((prev) => {
    const next = new Set(prev);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    return next;
  });
}
```

- [ ] **Step 2: Aplicar el collapse en el render de secciones**

Para cada sección en el render, envolver los items en:

```tsx
{!collapsedSections.has(section) && (
  <div>{/* items de la sección */}</div>
)}
```

El header de la sección debe mostrar un chevron que alterna:

```tsx
<button
  onClick={() => toggleSection(section)}
  className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-400"
>
  {NAV_SECTION_LABELS[section]}
  <ChevronRight
    className={cn("h-3 w-3 transition-transform", !collapsedSections.has(section) && "rotate-90")}
  />
</button>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/nav/desktop-sidebar.tsx
git commit -m "feat(sidebar): collapsible Sistema section — collapsed by default

Sistema (VPS, Blog, Configuración) collapses to keep NÚCLEO items prominent."
```

---

## Task 16: Cleanup final — redirects permanentes + asistente/herramientas removal

> **Ejecutar solo después de confirmar en producción que /tareas y /accesos funcionan correctamente durante al menos 7 días.**

**Archivos:**
- Modify: `next.config.ts` — cambiar `permanent: false` → `permanent: true`
- Delete: `src/app/(admin)/asistente/` — después de que redirects están estables
- Delete: `src/app/(admin)/herramientas/` — después de que redirects están estables

- [ ] **Step 1: Confirmar que los redirects funcionan en producción**

```bash
curl -I https://pixeltec.mx/asistente
# Expected: HTTP 302 → /tareas

curl -I https://pixeltec.mx/herramientas
# Expected: HTTP 302 → /accesos

curl -I https://pixeltec.mx/dashboard
# Expected: HTTP 302 → /hoy
```

- [ ] **Step 2: Cambiar redirects a permanentes en next.config.ts**

Cambiar todos los `permanent: false` agregados en Task 2 a `permanent: true`.

- [ ] **Step 3: Eliminar carpetas legacy (opcional — hacer en Semana 6)**

```bash
# Solo si los redirects permanentes están activos y verificados
rm -rf /home/ubuntu/pixeltec-os/src/app/\(admin\)/asistente
rm -rf /home/ubuntu/pixeltec-os/src/app/\(admin\)/herramientas
```

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore(cleanup): finalize IA redesign — permanent redirects, remove legacy routes

Semana 6 cleanup: /asistente and /herramientas routes removed.
Redirects promoted to 301 (permanent)."
```

---

## Verificación final

- [ ] **TypeScript limpio:**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck
```

Expected: 0 errores.

- [ ] **Build limpio:**

```bash
cd /home/ubuntu/pixeltec-os && npm run build 2>&1 | tail -10
```

Expected: sin errores. Puede haber warnings pre-existentes de `img` vs `next/image`.

- [ ] **Verificar pantalla de inicio:**

```bash
curl -I https://pixeltec.mx/dashboard
# Expected: 301/302 → /hoy
```

- [ ] **Verificar datos en /hoy:**

```bash
curl -s --compressed https://pixeltec.mx/hoy --cookie "__session=<session_cookie>" | grep -i "hoy\|tareas"
```

- [ ] **Verificar índice collectionGroup:**

En Firebase Console → Firestore → Indexes, confirmar que el índice `projects (COLLECTION_GROUP)` está `Enabled`.

- [ ] **Verificar sidebar en producción:**

Navegar a pixeltec.mx con sesión activa. Confirmar:
- Sección NÚCLEO visible con Hoy, Tareas, Proyectos, Clientes
- Sección GESTIÓN visible con Cobros, Accesos
- Sección SISTEMA colapsada por defecto (se expande al click)
- Crypto Intel NO visible en sidebar, SÍ buscable en ⌘K
