# Patch v2 — PixelTEC OS IA Redesign Plan

**Aplica sobre:** `docs/superpowers/plans/2026-06-16-pixeltec-os-ia-redesign.md`  
**Fecha:** 2026-06-16  
**Motivo:** Simplificación de MVP — eliminar health scoring, ClientPending con cobros, reordenar Cobros a Semana 6, y agregar Success Criteria.

---

## Cambio 1 — Header del plan

### Goal (línea 5)
**REEMPLAZAR:**
```
Reimplementar la arquitectura de información de PixelTEC OS conforme al Product Architecture Document aprobado (2026-06-16): nueva pantalla principal `Hoy`, elevación de `Tareas` y `Proyectos` como entidades primarias, módulo `Cobros`, sección `Sistema` colapsada, y `Crypto Intel` fuera del núcleo de navegación.
```

**POR:**
```
Reimplementar la arquitectura de información de PixelTEC OS conforme al Product Architecture Document aprobado (2026-06-16): nueva pantalla principal `Hoy`, elevación de `Tareas` y `Proyectos` como entidades primarias, sección `Sistema` colapsada, y `Crypto Intel` fuera del núcleo de navegación. Cobros es Semana 6 (post-MVP).
```

### Architecture (línea 7)
**REEMPLAZAR:**
```
El nuevo módulo `/hoy` consulta tareas del día (`AssistantTaskDoc.startsAt` dentro del día actual en TZ México), proyectos activos vía `collectionGroup('projects')`, y clientes con actualizaciones pendientes.
```

**POR:**
```
El nuevo módulo `/hoy` consulta tareas del día (`AssistantTaskDoc.startsAt` dentro del día actual en TZ México), proyectos activos vía `collectionGroup('projects')` (nombre + cliente + última actividad, sin scoring), y los 5 clientes con actividad más reciente. Sin reglas de negocio automáticas en MVP.
```

---

## Cambio 2 — Roadmap 6 semanas

**REEMPLAZAR tabla completa:**

| Semana | Fase | Tasks | Entrega |
|---|---|---|---|
| 1 | Foundation | 1–3 | Nav rewired, middleware actualizado, tipos base |
| 2 | Hoy MVP | 4–8 | `/hoy` funcional — pantalla de inicio operativa |
| 3 | Tareas + Proyectos | 9–12 | `/tareas` como ruta canónica, `/proyectos` list |
| 4 | Cobros | 13–15 | Módulo `/cobros` con CRUD básico |
| 5 | Accesos + Clientes | 16–17 | `/accesos`, reframe de `/clientes` |
| 6 | Sistema + Cleanup | 18–20 | Sidebar Sistema colapsado, crypto oculto, redirects finales |

**POR:**

| Semana | Fase | Tasks | Entrega |
|---|---|---|---|
| 1 | Foundation | 1–3 | Nav rewired, middleware actualizado, tipos base |
| 2 | Hoy MVP | 4–8 | `/hoy` funcional — pantalla de inicio operativa |
| 3 | Tareas + Proyectos | 9–11 | `/tareas` como ruta canónica, `/proyectos` list, índice Firestore |
| 4 | Clientes | 12 | `/clientes` reframe — directorio de cuentas, portal links |
| 5 | Accesos | 13–14 | `/accesos` reemplaza `/herramientas` |
| 6 | Cobros + Cleanup | 15–17 | Módulo `/cobros`, sidebar Sistema, redirects permanentes |

---

## Cambio 3 — Mapa de archivos (sección "Archivos a CREAR")

**REEMPLAZAR el bloque `src/lib/hoy/`:**
```
src/lib/hoy/
  types.ts                          — TodayTask, ProjectHealth, ClientPending
  queries.ts                        — getTodayTasks, getProjectsHealth, getClientsPending
```

**POR:**
```
src/lib/hoy/
  types.ts                          — TodayTask, ActiveProject, RecentClient, TodayData
```

**REEMPLAZAR las líneas del bloque `src/app/(admin)/hoy/_components/`:**
```
    projects-health-panel.tsx       — Zona B: proyectos con semáforo
    client-pending-panel.tsx        — Zona C: clientes con pendientes
```

**POR:**
```
    active-projects-panel.tsx       — Zona B: proyectos activos con última actividad
    recent-clients-panel.tsx        — Zona C: clientes con actividad reciente
```

**MOVER el bloque de `src/app/(admin)/cobros/` a la nota "Semana 6 — Post-MVP":**  
El directorio `/cobros/` pasa a ser creado en Task 15 (Semana 6), no en el mapa inicial de archivos.

---

## Cambio 4 — Riesgos de arquitectura

**REEMPLAZAR la fila:**
```
| `collectionGroup('projects')` requiere índice Firestore | Bloquea `/proyectos` list y `/hoy` health panel | Crear índice antes del deploy (Task 12) |
```

**POR:**
```
| `collectionGroup('projects')` requiere índice Firestore | Bloquea `/proyectos` list y `/hoy` ActiveProjectsPanel | Crear índice antes del deploy (Task 11) |
```

**ELIMINAR la fila:**
```
| `RecurringCharge` del CRM no migra a `cobros` | `/cobros` arranca vacío | Decisión de producto aceptada — datos nuevos en colección nueva |
```

---

## Cambio 5 — Descripción del ítem "Hoy" en command-palette-items.ts (Task 1)

**REEMPLAZAR:**
```typescript
description: "Tareas del día, proyectos en riesgo y pendientes de clientes",
```

**POR:**
```typescript
description: "Tareas del día, proyectos activos y actividad reciente de clientes",
```

---

## Cambio 6 — Task 3: `src/lib/hoy/types.ts` (reemplazo completo del Step 2)

**REEMPLAZAR el bloque de código en Step 2:**

```typescript
// ELIMINAR completamente:
export type ProjectHealthStatus = 'verde' | 'amarillo' | 'rojo';

export interface ProjectHealth {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  domain: string;
  status: ProjectHealthStatus;
  statusReason: string | null;
  lastActivityAt: string | null;
}

export interface ClientPending {
  id: string;
  name: string;
  slug: string;
  pendingUpdates: number;
  pendingCobros: number;
}

export interface TodayData {
  tasks: TodayTask[];
  projects: ProjectHealth[];
  clients: ClientPending[];
  asOf: string;
}
```

**POR:**

```typescript
export interface ActiveProject {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  domain: string;
  lastActivityAt: string | null; // ISO string — updatedAt del documento proyecto
}

export interface RecentClient {
  id: string;
  name: string;
  slug: string;
  lastActivityAt: string | null; // ISO string — updatedAt del documento cliente
}

export interface TodayData {
  tasks: TodayTask[];
  projects: ActiveProject[];
  clients: RecentClient[];
  asOf: string;
}
```

**REEMPLAZAR el commit message en Step 3:**
```
git commit -m "feat(hoy): add TodayTask, ProjectHealth, ClientPending types"
```
**POR:**
```
git commit -m "feat(hoy): add TodayTask, ActiveProject, RecentClient types — no health scoring"
```

---

## Cambio 7 — Task 5: `src/app/(admin)/hoy/actions.ts` (tres funciones cambian)

### 7a — Imports (reemplazar las referencias a tipos eliminados)

**REEMPLAZAR:**
```typescript
import type { TodayTask, ProjectHealth, ClientPending, TodayData } from "@/lib/hoy/types";
```

**POR:**
```typescript
import type { TodayTask, ActiveProject, RecentClient, TodayData } from "@/lib/hoy/types";
```

### 7b — Función `getProjectsHealth()` (reemplazo completo)

**ELIMINAR** la función entera `getProjectsHealth()` (desde `export async function getProjectsHealth` hasta el `return results.sort(...)` y el `}`).

**REEMPLAZAR POR:**

```typescript
export async function getActiveProjects(): Promise<ActiveProject[]> {
  const db = getAdminFirestore();

  // collectionGroup requiere índice — ver Task 11 para instrucciones de deploy
  const snap = await db
    .collectionGroup("projects")
    .where("active", "==", true)
    .orderBy("updatedAt", "desc")
    .limit(20)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const clientId = doc.ref.parent.parent?.id ?? "";
    const updatedAt = data.updatedAt as Timestamp | undefined;

    return {
      id: doc.id,
      clientId,
      clientName: data.clientName as string ?? "",
      name: data.name as string ?? "",
      domain: data.domain as string ?? "",
      lastActivityAt: updatedAt ? updatedAt.toDate().toISOString() : null,
    } satisfies ActiveProject;
  });
}
```

### 7c — Función `getClientsPending()` (reemplazo completo)

**ELIMINAR** la función entera `getClientsPending()`.

**REEMPLAZAR POR:**

```typescript
export async function getRecentClients(): Promise<RecentClient[]> {
  const db = getAdminFirestore();

  const snap = await db
    .collection("clients")
    .orderBy("updatedAt", "desc")
    .limit(5)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    const updatedAt = data.updatedAt as Timestamp | undefined;

    return {
      id: doc.id,
      name: data.name as string ?? "",
      slug: data.slug as string ?? "",
      lastActivityAt: updatedAt ? updatedAt.toDate().toISOString() : null,
    } satisfies RecentClient;
  });
}
```

### 7d — Función `getTodayData()` (actualizar llamadas)

**REEMPLAZAR:**
```typescript
export async function getTodayData(): Promise<TodayData> {
  const now = new Date();
  const [tasks, projects, clients] = await Promise.all([
    getTodayTasks(),
    getProjectsHealth(),
    getClientsPending(),
  ]);
```

**POR:**
```typescript
export async function getTodayData(): Promise<TodayData> {
  const now = new Date();
  const [tasks, projects, clients] = await Promise.all([
    getTodayTasks(),
    getActiveProjects(),
    getRecentClients(),
  ]);
```

### 7e — Commit message (Step 4)

**REEMPLAZAR:**
```
git commit -m "feat(hoy): server actions — getTodayTasks, getProjectsHealth, getClientsPending, getTodayData"
```

**POR:**
```
git commit -m "feat(hoy): server actions — getTodayTasks, getActiveProjects, getRecentClients, getTodayData

No health scoring. Projects: nombre + cliente + última actividad.
Clients: top 5 por actividad reciente."
```

---

## Cambio 8 — Task 6: Renombrar y simplificar `projects-health-panel.tsx`

### Nombre del archivo

**REEMPLAZAR** en el título y en la sección **Archivos:**
```
- Create: `src/app/(admin)/hoy/_components/projects-health-panel.tsx`
```

**POR:**
```
- Create: `src/app/(admin)/hoy/_components/active-projects-panel.tsx`
```

### Contenido del componente (reemplazo completo del bloque de código)

**REEMPLAZAR** todo el código del componente `projects-health-panel.tsx` **POR:**

```typescript
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { ActiveProject } from "@/lib/hoy/types";

function ProjectRow({ project }: { project: ActiveProject }) {
  const lastActivity = project.lastActivityAt
    ? formatDistanceToNow(new Date(project.lastActivityAt), {
        addSuffix: true,
        locale: es,
      })
    : "Sin actividad registrada";

  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{project.name}</p>
        <p className="text-xs text-zinc-500 truncate">
          {project.clientName}
          {project.domain && <span className="ml-1 text-zinc-600">· {project.domain}</span>}
        </p>
        <p className="text-xs text-zinc-600 mt-0.5">{lastActivity}</p>
      </div>
    </Link>
  );
}

interface ActiveProjectsPanelProps {
  projects: ActiveProject[];
}

export function ActiveProjectsPanel({ projects }: ActiveProjectsPanelProps) {
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
        projects.map((p) => <ProjectRow key={p.id} project={p} />)
      )}
    </div>
  );
}
```

### Commit message

**REEMPLAZAR:**
```
git commit -m "feat(hoy): ProjectsHealthPanel (Zona B) y ClientPendingPanel (Zona C)"
```

**POR:**
```
git commit -m "feat(hoy): ActiveProjectsPanel (Zona B) y RecentClientsPanel (Zona C)

Sin semáforos ni scoring. Proyectos: nombre + cliente + última actividad.
Clientes: top 5 por actividad reciente."
```

---

## Cambio 9 — Task 7: Renombrar y simplificar `client-pending-panel.tsx`

### Nombre del archivo

**REEMPLAZAR:**
```
- Create: `src/app/(admin)/hoy/_components/client-pending-panel.tsx`
```

**POR:**
```
- Create: `src/app/(admin)/hoy/_components/recent-clients-panel.tsx`
```

### Contenido del componente (reemplazo completo)

**REEMPLAZAR** todo el código del componente `client-pending-panel.tsx` **POR:**

```typescript
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { RecentClient } from "@/lib/hoy/types";

function ClientRow({ client }: { client: RecentClient }) {
  const lastActivity = client.lastActivityAt
    ? formatDistanceToNow(new Date(client.lastActivityAt), {
        addSuffix: true,
        locale: es,
      })
    : "Sin actividad registrada";

  return (
    <Link
      href={`/clientes/${client.id}`}
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100 truncate">{client.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{lastActivity}</p>
      </div>
    </Link>
  );
}

interface RecentClientsPanelProps {
  clients: RecentClient[];
}

export function RecentClientsPanel({ clients }: RecentClientsPanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Clientes recientes
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
          Sin clientes registrados
        </p>
      ) : (
        clients.map((c) => <ClientRow key={c.id} client={c} />)
      )}
    </div>
  );
}
```

---

## Cambio 10 — Task 8: `/hoy/page.tsx` — actualizar imports y nombres de componentes

**REEMPLAZAR:**
```typescript
import { ProjectsHealthPanel } from "./_components/projects-health-panel";
import { ClientPendingPanel } from "./_components/client-pending-panel";
```

**POR:**
```typescript
import { ActiveProjectsPanel } from "./_components/active-projects-panel";
import { RecentClientsPanel } from "./_components/recent-clients-panel";
```

**REEMPLAZAR en el JSX:**
```tsx
<ProjectsHealthPanel projects={data.projects} />
```
**POR:**
```tsx
<ActiveProjectsPanel projects={data.projects} />
```

**REEMPLAZAR en el JSX:**
```tsx
<ClientPendingPanel clients={data.clients} />
```
**POR:**
```tsx
<RecentClientsPanel clients={data.clients} />
```

**REEMPLAZAR los fallback skeletons** (mismos 3 divs — sin cambios funcionales, solo para completitud).

**REEMPLAZAR el commit message del Step 4:**
```
git commit -m "feat(hoy): MVP completo — pantalla de inicio operativa

Zona A: tareas del día con vencidas resaltadas
Zona B: proyectos activos con semáforo verde/amarillo/rojo
Zona C: clientes con actualizaciones o cobros pendientes
/dashboard redirige automáticamente a /hoy"
```

**POR:**
```
git commit -m "feat(hoy): MVP completo — pantalla de inicio operativa

Zona A: tareas del día con vencidas resaltadas
Zona B: proyectos activos con última actividad (sin scoring)
Zona C: top 5 clientes por actividad reciente
/dashboard redirige automáticamente a /hoy"
```

---

## Cambio 11 — Task 10: `/proyectos` — actualizar imports

En `src/app/(admin)/proyectos/page.tsx`, el componente usa `ProjectHealth` para tipado. 

**REEMPLAZAR:**
```typescript
import type { ProjectHealth } from "@/lib/hoy/types";
```

**POR:**
```typescript
import type { ActiveProject } from "@/lib/hoy/types";
```

**REEMPLAZAR** en la firma de `ProjectCard`:
```typescript
function ProjectCard({ project }: { project: ProjectHealth }) {
```

**POR:**
```typescript
function ProjectCard({ project }: { project: ActiveProject }) {
```

**REEMPLAZAR** el bloque de render que separa `atRisk` / `healthy` con semáforo:

```typescript
// ELIMINAR completamente:
const STATUS_COLORS = { ... }
const STATUS_LABELS = { ... }
const atRisk = projects.filter((p) => p.status !== "verde");
const healthy = projects.filter((p) => p.status === "verde");
```

**REEMPLAZAR** el cuerpo de `ProjectCard` **POR:**

```typescript
function ProjectCard({ project }: { project: ActiveProject }) {
  const lastActivity = project.lastActivityAt
    ? formatDistanceToNow(new Date(project.lastActivityAt), {
        addSuffix: true,
        locale: es,
      })
    : "Sin actividad registrada";

  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="block bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 hover:border-zinc-700 transition-colors"
    >
      <p className="font-medium text-zinc-100 truncate">{project.name}</p>
      <p className="text-sm text-zinc-400 mt-0.5">{project.clientName}</p>
      {project.domain && (
        <p className="text-xs text-zinc-600 mt-1">{project.domain}</p>
      )}
      <p className="text-xs text-zinc-500 mt-2">{lastActivity}</p>
    </Link>
  );
}
```

**REEMPLAZAR** la función `ProyectosContent` para eliminar las dos secciones (atRisk/healthy):

```typescript
async function ProyectosContent() {
  const projects = await getAllActiveProjects();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.length === 0 ? (
        <p className="text-zinc-500 col-span-full text-center py-12">
          No hay proyectos activos registrados.
        </p>
      ) : (
        projects.map((p) => <ProjectCard key={p.id} project={p} />)
      )}
    </div>
  );
}
```

**AGREGAR import al inicio del archivo:**
```typescript
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
```

---

## Cambio 12 — Renumerar Tasks de Cobros: 12–13 → 15–17

Las tasks de Cobros (`Task 12: Módulo /cobros — tipos` y `Task 13: Módulo /cobros — Server Actions y página`) se mueven a **Semana 6**.

**Renumeración completa:**

| Número original | Nuevo número | Cambio |
|---|---|---|
| Task 11 (Índice Firestore) | Task 11 | Sin cambio |
| Task 12 (Cobros tipos) | **Task 15** | Mover a Semana 6 |
| Task 13 (Cobros página) | **Task 16** | Mover a Semana 6 |
| Task 14 (/accesos) | **Task 13** | Adelantar a Semana 5 |
| Task 15 (Sidebar collapse) | **Task 14** | Adelantar a Semana 5 |
| Task 16 (Cleanup final) | **Task 17** | Mover a Semana 6 |

**INSERTAR** entre las Tasks actuales 14 y 15 (ahora 13 y 14) la nueva **Task 12: /clientes reframe** que faltaba en el plan original:

### Task 12: /clientes — reframe como directorio de cuentas (NUEVA)

**Semana 4**

**Archivos:**
- Modify: `src/app/(admin)/clientes/page.tsx`

- [ ] **Step 1: Localizar el texto "pipeline" en la página de clientes**

```bash
grep -n "pipeline\|CRM\|Pipeline" \
  /home/ubuntu/pixeltec-os/src/app/\(admin\)/clientes/page.tsx
```

- [ ] **Step 2: Actualizar la descripción de la página**

Reemplazar cualquier referencia a "pipeline comercial", "CRM" o "gestión de leads" en subtítulos o descripciones visibles por:

- Título: "Clientes"
- Subtítulo: "Directorio de cuentas activas"

- [ ] **Step 3: Agregar link al portal del cliente**

En la vista de detalle `src/app/(admin)/clientes/[id]/page.tsx`, agregar link al portal:

```tsx
<a
  href={`/${client.slug}/dashboard`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xs text-cyan-400 hover:text-cyan-300"
>
  Ver portal del cliente →
</a>
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck 2>&1 | grep "clientes" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/clientes/
git commit -m "refactor(clientes): reframe as account directory — remove CRM/pipeline language

Added portal link in client detail view.
Subtitle updated to 'Directorio de cuentas activas'."
```

---

## Cambio 13 — Agregar sección Success Criteria al plan

**INSERTAR** inmediatamente después del "Roadmap 6 semanas" y antes de "Mapa de archivos":

---

## Product Success Criteria

Cada sprint se da por completado solo cuando cumple sus criterios. El código que compila no es suficiente — el comportamiento observable en uso real lo es.

### Sprint 1 — Foundation
- [ ] La navegación nueva (Núcleo / Gestión / Sistema) aparece en sidebar y ⌘K
- [ ] No hay rutas rotas: `/dashboard`, `/asistente`, `/herramientas` redirigen sin 404
- [ ] `/hoy` responde con sesión activa

### Sprint 2 — Hoy
- [ ] El sistema abre en `/hoy` al iniciar sesión
- [ ] Miguel puede identificar sus tareas del día en menos de 30 segundos sin entrenamiento
- [ ] La pantalla se usa durante 5 días de trabajo reales antes de continuar al Sprint 3
- [ ] Los tres paneles (Tareas / Proyectos / Clientes recientes) muestran datos reales, no vacíos

### Sprint 3 — Tareas + Proyectos
- [ ] Todas las tareas activas son accesibles desde `/tareas` sin pasar por `/clientes`
- [ ] Editar una tarea requiere máximo 2 clics desde `/hoy` o `/tareas`
- [ ] `/proyectos` lista todos los proyectos activos de todos los clientes en una sola vista
- [ ] Los redirects `/asistente → /tareas` funcionan correctamente en producción

### Sprint 4 — Clientes
- [ ] Cualquier cliente es accesible en máximo 1 clic desde el sidebar
- [ ] La ficha de cliente (`/clientes/[id]`) tiene link directo al portal del cliente
- [ ] No aparece lenguaje de "CRM" o "pipeline" en la interfaz

### Sprint 5 — Accesos
- [ ] Cualquier credencial de proyecto es localizable en menos de 10 segundos
- [ ] `/herramientas` redirige a `/accesos` sin error
- [ ] El ⌘K encuentra items de accesos por nombre de proyecto o cliente

### Sprint 6 — Cobros
- [ ] La lista de cobros muestra al menos un cobro real (no solo el estado vacío)
- [ ] El flujo "crear cobro → asignar a cliente → marcar pagado" completa sin errores
- [ ] `/cobros` no depende de datos del CRM blob (`crm_data/{uid}`)
- [ ] Crypto Intel sigue funcionando desde ⌘K aunque no esté en sidebar

---

## Cambio 14 — Nueva sección al final del plan

**INSERTAR** como sección final, antes de "Verificación final":

---

## Deferred Features (Post-MVP)

Las siguientes características fueron evaluadas y descartadas del MVP por introducir complejidad prematura. Se documentan aquí para referencia futura.

### Project Health Score
Motor de clasificación verde/amarillo/rojo basado en:
- Actividad de los últimos 7 días
- Fecha de entrega próxima (≤3 días → amarillo)
- Tareas bloqueadas
- Ausencia total de actividad (→ rojo)

**Por qué se difirió:** Requiere que los documentos de proyecto tengan `active`, `updatedAt`, y `dueDate` con valores confiables y consistentes. Antes de construir el scoring hay que validar la calidad de esos datos en producción.

**Dónde irá cuando se implemente:** `src/lib/hoy/health-scoring.ts` con función `scoreProject(project: ActiveProject): ProjectHealthStatus`. El `ProjectHealth` original del plan v1 sirve como spec de ese tipo.

### Client Attention Score
Clasificación de clientes por urgencia basada en:
- Actualizaciones de proyecto sin enviar al portal (`sentToPortal === false`)
- Cobros vencidos o próximos a vencer

**Por qué se difirió:** Depende de que exista la colección `cobros` (Semana 6) y de que los documentos de `clients/{id}/updates` usen el campo `sentToPortal` de forma consistente.

**Dónde irá:** Extender `RecentClient` con `pendingUpdates: number` y `pendingCobros: number` después de validar datos.

### Cobros integrados en /hoy
Panel de cobros vencidos o próximos visible en la pantalla Hoy.

**Por qué se difirió:** La colección `cobros` no existe todavía. Integrarla antes de que haya datos reales produce un panel vacío sin valor.

**Dónde irá:** `getClientsPending()` en `actions.ts` hace un join con `cobros` una vez que la colección tenga datos reales.

### Alertas automáticas
Notificaciones proactivas cuando un proyecto lleva 7+ días sin actividad, o cuando un cobro vence.

**Por qué se difirió:** Requiere health scoring estable + canal de notificación definido (ya existe `notifications/{id}` en Firestore y Resend/WhatsApp).

### Métricas predictivas
Proyección de ingresos, estimación de carga del equipo, detección de proyectos en riesgo de retraso basada en velocidad histórica de tareas.

**Por qué se difirió:** Requiere datos históricos acumulados durante al menos 3–6 meses de uso real del sistema.

---
