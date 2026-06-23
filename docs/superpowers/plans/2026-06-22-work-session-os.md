# Work Session OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform cada tarea de proyecto en un punto de entrada a una sesión de trabajo inmersiva con timer continuo, historial de actividades, notas, bloqueos y resumen al finalizar.

**Architecture:** Nueva ruta `/proyectos/[id]/sesion?taskId=xxx` que renderiza un workspace de pantalla completa. Los datos de sesión se almacenan en `crm_data/{userUid}.sessions` en Firestore (mismo documento que el CRM). El timer se computa desde `session.startedAt` en el cliente para sobrevivir recargas. El estado local de la sesión vive en un hook `useWorkSession`.

**Tech Stack:** Next.js App Router, React hooks, Firestore (via CRMContext), Tailwind CSS, Lucide icons, Sonner toasts. Sin IA, sin integraciones externas.

## Global Constraints

- Sin Pomodoro clásico — timer continuo solamente
- Sin IA, sin GitHub API, sin VSCode integration
- Español en toda la UI
- Dark theme: `bg-[#0F0F12]`, zinc-*, cyan-400 accent — mismo sistema que el resto del app
- Firestore: todos los datos en `crm_data/{userUid}` como en el CRM existente
- Ruta: `/proyectos/[id]/sesion` con `taskId` como query param
- No romper el Pomodoro existente (CRMShellProvider) — solo agregar botón adicional

---

## File Map

**New files:**
- `src/types/session.ts` — WorkSession, SessionActivity, SessionNote, SessionBlock types
- `src/app/(admin)/proyectos/[id]/sesion/page.tsx` — Route page (thin shell)
- `src/components/workspace/WorkspaceLayout.tsx` — Assembles all workspace pieces
- `src/components/workspace/WorkspaceHeader.tsx` — Top bar: cliente/proyecto/tarea + botón Finalizar
- `src/components/workspace/SessionTimer.tsx` — Timer continuo computado desde startedAt
- `src/components/workspace/CurrentActivity.tsx` — Campo editable + botón "Actividad terminada"
- `src/components/workspace/ActivityTimeline.tsx` — Timeline cronológico de actividades de la sesión
- `src/components/workspace/FocusGuard.tsx` — Detector de inactividad 20 min con diálogo
- `src/components/workspace/QuickNotepad.tsx` — Notas rápidas de la sesión
- `src/components/workspace/BlockReporter.tsx` — Modal para reportar bloqueo
- `src/components/workspace/EndSessionDialog.tsx` — Confirmación deploy/commit + resumen
- `src/components/workspace/SmartSidebar.tsx` — Panel lateral con cards de buenas prácticas
- `src/hooks/use-work-session.ts` — Hook que gestiona timer + inactividad + acciones de sesión

**Modified files:**
- `src/types/crm.ts` — No se modifica (tipos en archivo separado para no aumentar tamaño)
- `src/components/crm/CRMContext.tsx` — Agregar `sessions`, y métodos: `startSession`, `updateCurrentActivity`, `completeActivity`, `addSessionNote`, `addSessionBlock`, `endSession`, `getProjectSessions`
- `src/components/crm/ProjectView.tsx` — Agregar botón "▶ Iniciar sesión" en lista y kanban de tareas

---

### Task 1: Session Types + CRMContext session layer

**Files:**
- Create: `src/types/session.ts`
- Modify: `src/components/crm/CRMContext.tsx` (lines 1-397)

**Interfaces:**
- Produces: `WorkSession`, `SessionActivity`, `SessionNote`, `SessionBlock`, `BlockType` — usados por todos los tasks siguientes
- Produces: `useCRM()` expone `sessions: WorkSession[]`, `startSession`, `updateCurrentActivity`, `completeActivity`, `addSessionNote`, `addSessionBlock`, `endSession`

- [ ] **Step 1: Crear `src/types/session.ts`**

```typescript
export type BlockType =
  | "error_api"
  | "acceso_faltante"
  | "pendiente_cliente"
  | "dependencia_externa";

export const BLOCK_LABELS: Record<BlockType, string> = {
  error_api: "Error de API",
  acceso_faltante: "Acceso faltante",
  pendiente_cliente: "Pendiente de cliente",
  dependencia_externa: "Dependencia externa",
};

export interface SessionActivity {
  id: string;
  description: string;
  startedAt: string;   // ISO
  completedAt?: string; // ISO — undefined means current activity
}

export interface SessionNote {
  id: string;
  content: string;
  createdAt: string; // ISO
}

export interface SessionBlock {
  id: string;
  type: BlockType;
  description: string;
  createdAt: string; // ISO
  resolved: boolean;
}

export interface WorkSession {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  clientName: string;   // denormalized at creation
  projectName: string;  // denormalized at creation
  taskName: string;     // denormalized at creation
  startedAt: string;    // ISO
  endedAt?: string;     // ISO
  durationSeconds?: number;
  activities: SessionActivity[];
  notes: SessionNote[];
  blocks: SessionBlock[];
  deployDone?: boolean | null; // true=sí, false=no, null=no aplica
  commitDone?: boolean;
  status: "active" | "ended";
}
```

- [ ] **Step 2: Agregar `sessions` al CRMContext — importar tipo y extender interface**

En `src/components/crm/CRMContext.tsx`, agregar al top:

```typescript
import type { WorkSession, BlockType } from "@/types/session";
```

En `interface CRMContextValue` (después de `deleteCharge`), agregar:

```typescript
  sessions: WorkSession[];
  startSession: (clientId: string, projectId: string, taskId: string, clientName: string, projectName: string, taskName: string) => WorkSession;
  updateCurrentActivity: (sessionId: string, description: string) => void;
  completeActivity: (sessionId: string) => void;
  addSessionNote: (sessionId: string, content: string) => void;
  addSessionBlock: (sessionId: string, type: BlockType, description: string) => void;
  endSession: (sessionId: string, deployDone: boolean | null, commitDone: boolean) => void;
  getProjectSessions: (projectId: string) => WorkSession[];
```

- [ ] **Step 3: Agregar estado `sessions` al provider**

Dentro de `CRMProvider`, después de `const [serverLinks, setServerLinks]`, agregar:

```typescript
  const [sessions, setSessions] = useState<WorkSession[]>([]);
```

En `dataRef.current` (línea 65), cambiar el tipo a incluir sessions:

```typescript
  const dataRef = useRef<{
    clients: CRMClient[];
    tools: Tool[];
    streak: number;
    serverLinks: ServerClientLink;
    sessions: WorkSession[];
  }>({ clients: [], tools: [], streak: 0, serverLinks: {}, sessions: [] });
```

- [ ] **Step 4: Cargar sessions desde Firestore**

En el `useEffect` de carga (dentro del bloque `if (snap.exists())`), después de `setServerLinks(d.serverLinks || {})`:

```typescript
            const loadedSessions: WorkSession[] = d.sessions || [];
            setSessions(loadedSessions);
            dataRef.current = {
              clients: loadedClients,
              tools: d.tools || [],
              streak: d.streak || 0,
              serverLinks: d.serverLinks || {},
              sessions: loadedSessions,
            };
```

Reemplaza el `dataRef.current = { clients: loadedClients, tools: ... }` existente (línea 96) con el bloque de arriba.

- [ ] **Step 5: Incluir sessions en el `persist()`**

En la llamada a `setDoc` dentro de `persist` (línea ~126), agregar `sessions`:

```typescript
        await setDoc(doc(firestore, "crm_data", userUid), {
          clients: dataRef.current.clients,
          tools: dataRef.current.tools,
          streak: dataRef.current.streak,
          serverLinks: dataRef.current.serverLinks,
          sessions: dataRef.current.sessions,
          lastActivity: new Date().toISOString(),
        });
```

- [ ] **Step 6: Implementar los 6 métodos de sesión**

Agregar después de `deleteCharge`:

```typescript
  const updateSessions = useCallback((newSessions: WorkSession[]) => {
    setSessions(newSessions);
    dataRef.current.sessions = newSessions;
    persist();
  }, [persist]);

  const startSession = useCallback((
    clientId: string, projectId: string, taskId: string,
    clientName: string, projectName: string, taskName: string
  ): WorkSession => {
    const session: WorkSession = {
      id: uid(),
      clientId, projectId, taskId,
      clientName, projectName, taskName,
      startedAt: new Date().toISOString(),
      activities: [],
      notes: [],
      blocks: [],
      status: "active",
    };
    updateSessions([...dataRef.current.sessions, session]);
    return session;
  }, [updateSessions]);

  const updateCurrentActivity = useCallback((sessionId: string, description: string) => {
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      const activities = s.activities.map(a =>
        !a.completedAt ? { ...a, description } : a
      );
      // If no open activity exists, create one
      const hasOpen = s.activities.some(a => !a.completedAt);
      if (!hasOpen) {
        activities.push({ id: uid(), description, startedAt: new Date().toISOString() });
      }
      return { ...s, activities };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const completeActivity = useCallback((sessionId: string) => {
    const now = new Date().toISOString();
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        activities: s.activities.map(a =>
          !a.completedAt ? { ...a, completedAt: now } : a
        ),
      };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const addSessionNote = useCallback((sessionId: string, content: string) => {
    const note = { id: uid(), content, createdAt: new Date().toISOString() };
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId ? { ...s, notes: [...s.notes, note] } : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const addSessionBlock = useCallback((sessionId: string, type: BlockType, description: string) => {
    const block = { id: uid(), type, description, createdAt: new Date().toISOString(), resolved: false };
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId ? { ...s, blocks: [...s.blocks, block] } : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const endSession = useCallback((sessionId: string, deployDone: boolean | null, commitDone: boolean) => {
    const now = new Date().toISOString();
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      const start = new Date(s.startedAt).getTime();
      const durationSeconds = Math.floor((Date.now() - start) / 1000);
      return { ...s, status: "ended" as const, endedAt: now, durationSeconds, deployDone, commitDone };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const getProjectSessions = useCallback((projectId: string): WorkSession[] => {
    return dataRef.current.sessions.filter(s => s.projectId === projectId);
  }, []);
```

- [ ] **Step 7: Exponer en el CRMCtx.Provider**

En el bloque `<CRMCtx.Provider value={{...}}>` (línea ~382), agregar después de `deleteCharge`:

```typescript
      sessions,
      startSession, updateCurrentActivity, completeActivity,
      addSessionNote, addSessionBlock, endSession, getProjectSessions,
```

- [ ] **Step 8: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```

Esperado: 0 errores relacionados con los nuevos tipos.

- [ ] **Step 9: Commit**

```bash
git add src/types/session.ts src/components/crm/CRMContext.tsx
git commit -m "feat(session): add WorkSession types + CRMContext session layer"
```

---

### Task 2: Session route page + "Iniciar sesión" in ProjectView

**Files:**
- Create: `src/app/(admin)/proyectos/[id]/sesion/page.tsx`
- Modify: `src/components/crm/ProjectView.tsx`

**Interfaces:**
- Consumes: `useCRM()` con `startSession` de Task 1
- Consumes: `useRouter()` de next/navigation
- Produces: ruta `/proyectos/[id]/sesion?taskId=xxx` accesible; ProjectView tiene botones "▶ Iniciar sesión"

- [ ] **Step 1: Crear `src/app/(admin)/proyectos/[id]/sesion/page.tsx`**

```typescript
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";

export default function SesionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const crm = useCRM();
  const sessionStarted = useRef(false);

  const taskId = searchParams.get("taskId") ?? "";

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  // Find project + client + task
  let client = null;
  let project = null;
  let task = null;
  for (const c of crm.clients) {
    const p = c.projects.find(pp => pp.id === params.id);
    if (p) {
      client = c;
      project = p;
      task = p.tasks.find(t => t.id === taskId) ?? null;
      break;
    }
  }

  if (!client || !project || !task) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 text-sm mb-4">Tarea no encontrada</p>
        <button
          onClick={() => router.push(`/proyectos/${params.id}?tab=tareas`)}
          className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-all"
        >
          ← Volver al proyecto
        </button>
      </div>
    );
  }

  // Find or create active session
  const activeSession = crm.sessions.find(
    s => s.projectId === project!.id && s.taskId === task!.id && s.status === "active"
  );

  // Start session on first render if none active
  useEffect(() => {
    if (!sessionStarted.current && !activeSession && client && project && task) {
      sessionStarted.current = true;
      crm.startSession(client.id, project.id, task.id, client.name, project.name, task.name);
    }
  }, [activeSession, client, project, task]);

  if (!activeSession) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  // WorkspaceLayout will be imported in Task 10
  return (
    <div className="p-6 text-zinc-300 text-sm">
      {/* Placeholder until WorkspaceLayout is built */}
      <p>Sesión activa: {activeSession.id}</p>
      <p>Tarea: {task.name}</p>
      <button
        onClick={() => router.push(`/proyectos/${params.id}?tab=tareas`)}
        className="mt-4 text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← Volver
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Agregar botón "▶ Iniciar sesión" en vista lista de ProjectView**

En `src/components/crm/ProjectView.tsx`, en el bloque de `taskView === "lista"` (línea ~479), agregar import de `useRouter`:

```typescript
import { useParams, useRouter } from "next/navigation";
```

Dentro de `ProjectView`, después de `const noteTimer = useRef(...)`:

```typescript
  const router = useRouter();
  const handleStartSession = (taskId: string) => {
    router.push(`/proyectos/${project.id}/sesion?taskId=${taskId}`);
  };
```

En la lista de tareas (dentro del `.map(task => ...)`), reemplazar el botón `▶` (Pomo):

```typescript
                    <button
                      onClick={() => handleStartSession(task.id)}
                      className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.08] px-2.5 py-1 text-[11px] font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 whitespace-nowrap"
                    >
                      ▶ Iniciar sesión
                    </button>
```

- [ ] **Step 3: Agregar botón "▶ Iniciar sesión" en KanbanCard**

En el componente `KanbanCard` (línea ~83), agregar `onStartSession` al interface:

```typescript
interface KanbanCardProps {
  task: CRMTask;
  clientId: string;
  projectId: string;
  cycleTaskStatus: (cid: string, pid: string, tid: string) => void;
  startPomo: (cid: string, pid: string, tid: string) => void;
  deleteTask: (cid: string, pid: string, tid: string) => void;
  onStartSession: (taskId: string) => void;
}
```

En el JSX de `KanbanCard`, reemplazar el botón `▶` (línea ~104):

```typescript
          <button
            onClick={() => props.onStartSession(task.id)}
            className="rounded px-1.5 py-0.5 text-[10px] text-cyan-400 transition-colors hover:bg-cyan-500/10"
          >
            ▶ Sesión
          </button>
```

En cada `<KanbanCard ... />` en el kanban grid, pasar la nueva prop:

```typescript
                        <KanbanCard
                          key={task.id}
                          task={task}
                          clientId={client.id}
                          projectId={project.id}
                          cycleTaskStatus={cycleTaskStatus}
                          startPomo={startPomo}
                          deleteTask={deleteTask}
                          onStartSession={handleStartSession}
                        />
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```

Esperado: 0 errores.

- [ ] **Step 5: Verificar en browser**

```bash
cd /home/ubuntu/pixeltec-os && npm run dev
```

1. Navegar a un proyecto con tareas
2. Clic en "▶ Iniciar sesión" en cualquier tarea
3. Debe redirigir a `/proyectos/[id]/sesion?taskId=[tid]`
4. Debe mostrar "Sesión activa: [id]" y el nombre de la tarea
5. Recargar la página — no debe crear una sesión duplicada

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/proyectos/\[id\]/sesion/page.tsx src/components/crm/ProjectView.tsx
git commit -m "feat(session): add /sesion route + Iniciar sesión buttons in ProjectView"
```

---

### Task 3: useWorkSession hook

**Files:**
- Create: `src/hooks/use-work-session.ts`

**Interfaces:**
- Consumes: `useCRM()` sessions + session methods (Task 1)
- Produces: `useWorkSession(sessionId)` → `{ session, elapsed, currentActivity, setCurrentActivityText, handleActivityDone, handleAddNote, handleAddBlock, handleEndSession, showInactiveAlert, setShowInactiveAlert }`

- [ ] **Step 1: Crear `src/hooks/use-work-session.ts`**

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCRM } from "@/components/crm/CRMContext";
import type { BlockType } from "@/types/session";

export function useWorkSession(sessionId: string) {
  const crm = useCRM();
  const session = crm.sessions.find(s => s.id === sessionId) ?? null;

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt]);

  // ── Actividad actual (texto local, persistido en blur o submit) ────────────
  const currentActivity = session?.activities.find(a => !a.completedAt) ?? null;
  const [activityText, setActivityText] = useState(currentActivity?.description ?? "");

  useEffect(() => {
    setActivityText(currentActivity?.description ?? "");
  }, [currentActivity?.id]);

  const handleActivityUpdate = useCallback(() => {
    if (!sessionId || !activityText.trim()) return;
    crm.updateCurrentActivity(sessionId, activityText.trim());
  }, [sessionId, activityText, crm]);

  const handleActivityDone = useCallback(() => {
    if (!sessionId) return;
    if (activityText.trim()) {
      crm.updateCurrentActivity(sessionId, activityText.trim());
    }
    crm.completeActivity(sessionId);
    setActivityText("");
  }, [sessionId, activityText, crm]);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const handleAddNote = useCallback((content: string) => {
    if (!sessionId || !content.trim()) return;
    crm.addSessionNote(sessionId, content.trim());
  }, [sessionId, crm]);

  // ── Blocks ────────────────────────────────────────────────────────────────
  const handleAddBlock = useCallback((type: BlockType, description: string) => {
    if (!sessionId) return;
    crm.addSessionBlock(sessionId, type, description);
  }, [sessionId, crm]);

  // ── End session ───────────────────────────────────────────────────────────
  const handleEndSession = useCallback((deployDone: boolean | null, commitDone: boolean) => {
    if (!sessionId) return;
    crm.endSession(sessionId, deployDone, commitDone);
  }, [sessionId, crm]);

  // ── Inactivity guard (20 min) ─────────────────────────────────────────────
  const [showInactiveAlert, setShowInactiveAlert] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const INACTIVE_MS = 20 * 60 * 1000;

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const reset = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousemove", reset, { passive: true });
    window.addEventListener("keydown", reset, { passive: true });
    window.addEventListener("click", reset, { passive: true });

    const check = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVE_MS) {
        setShowInactiveAlert(true);
      }
    }, 60_000);

    return () => {
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown", reset);
      window.removeEventListener("click", reset);
      clearInterval(check);
    };
  }, [session?.status]);

  return {
    session,
    elapsed,
    currentActivity,
    activityText,
    setActivityText,
    handleActivityUpdate,
    handleActivityDone,
    handleAddNote,
    handleAddBlock,
    handleEndSession,
    showInactiveAlert,
    setShowInactiveAlert,
  };
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-work-session.ts
git commit -m "feat(session): add useWorkSession hook with timer + inactivity guard"
```

---

### Task 4: WorkspaceHeader + SessionTimer components

**Files:**
- Create: `src/components/workspace/WorkspaceHeader.tsx`
- Create: `src/components/workspace/SessionTimer.tsx`

**Interfaces:**
- Consumes: `WorkSession` from Task 1; `elapsed: number` from `useWorkSession`
- Produces: `<WorkspaceHeader>`, `<SessionTimer>` — usados por WorkspaceLayout en Task 10

- [ ] **Step 1: Crear `src/components/workspace/WorkspaceHeader.tsx`**

```typescript
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkSession } from "@/types/session";

interface Props {
  session: WorkSession;
  onFinalize: () => void;
}

export function WorkspaceHeader({ session, onFinalize }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0F0F12] px-6 py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/proyectos/${session.projectId}?tab=tareas`)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{session.clientName}</span>
          <span className="text-zinc-700">·</span>
          <span>{session.projectName}</span>
          <span className="text-zinc-700">·</span>
          <span className="font-medium text-zinc-300">{session.taskName}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-green-400">Sesión activa</span>
        </div>
        <button
          onClick={onFinalize}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/30"
        >
          Finalizar sesión
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/workspace/SessionTimer.tsx`**

```typescript
"use client";

import type { WorkSession } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  session: WorkSession;
  elapsed: number; // seconds
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStartTime(isoString: string): string {
  try {
    return format(new Date(isoString), "h:mm a", { locale: es });
  } catch {
    return isoString;
  }
}

export function SessionTimer({ session, elapsed }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-5">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
        Ahora estás trabajando en
      </p>
      <div className="mb-4 space-y-0.5">
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-400">Cliente:</span> {session.clientName}
        </p>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-400">Proyecto:</span> {session.projectName}
        </p>
        <p className="text-sm font-semibold text-zinc-200">{session.taskName}</p>
      </div>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[10px] text-zinc-600">Sesión iniciada</p>
          <p className="text-sm font-medium text-zinc-400">{formatStartTime(session.startedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600">Tiempo trabajando</p>
          <p className="font-mono text-3xl font-bold tabular-nums text-zinc-100">
            {formatElapsed(elapsed)}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/WorkspaceHeader.tsx src/components/workspace/SessionTimer.tsx
git commit -m "feat(session): add WorkspaceHeader + SessionTimer components"
```

---

### Task 5: CurrentActivity + ActivityTimeline components

**Files:**
- Create: `src/components/workspace/CurrentActivity.tsx`
- Create: `src/components/workspace/ActivityTimeline.tsx`

**Interfaces:**
- Consumes: `activityText`, `setActivityText`, `handleActivityUpdate`, `handleActivityDone` from `useWorkSession`; `session.activities` from `WorkSession`
- Produces: `<CurrentActivity>`, `<ActivityTimeline>` — usados por WorkspaceLayout

- [ ] **Step 1: Crear `src/components/workspace/CurrentActivity.tsx`**

```typescript
"use client";

interface Props {
  activityText: string;
  onChange: (value: string) => void;
  onUpdate: () => void;
  onDone: () => void;
}

export function CurrentActivity({ activityText, onChange, onUpdate, onDone }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-2 text-xs font-semibold text-zinc-400">Actividad actual</p>
      <input
        type="text"
        value={activityText}
        onChange={e => onChange(e.target.value)}
        onBlur={onUpdate}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onUpdate(); } }}
        placeholder="Describe lo que estás haciendo ahora..."
        className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onUpdate}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:text-zinc-200"
        >
          Actualizar actividad
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-green-500/20 bg-green-500/[0.06] px-3 py-1.5 text-xs font-medium text-green-400 transition-all hover:bg-green-500/10"
        >
          ✓ Actividad terminada
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/workspace/ActivityTimeline.tsx`**

```typescript
"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionActivity } from "@/types/session";

interface Props {
  activities: SessionActivity[];
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

export function ActivityTimeline({ activities }: Props) {
  const completed = activities.filter(a => a.completedAt);

  if (completed.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-2 text-xs font-semibold text-zinc-400">Historial de actividades</p>
        <p className="text-center py-4 text-xs text-zinc-600">
          Aún no hay actividades completadas en esta sesión
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400">
        Historial de actividades ({completed.length})
      </p>
      <div className="relative space-y-0">
        {completed.map((activity, i) => (
          <div key={activity.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-500 mt-1" />
              {i < completed.length - 1 && (
                <div className="w-px flex-1 bg-white/[0.06] mt-1" style={{ minHeight: "20px" }} />
              )}
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-[10px] tabular-nums text-zinc-600">{formatTime(activity.startedAt)}</p>
              <p className="text-sm text-zinc-300">{activity.description || "Sin descripción"}</p>
              {activity.completedAt && (
                <p className="text-[10px] text-zinc-600">
                  → {formatTime(activity.completedAt)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/CurrentActivity.tsx src/components/workspace/ActivityTimeline.tsx
git commit -m "feat(session): add CurrentActivity + ActivityTimeline components"
```

---

### Task 6: FocusGuard (inactivity dialog)

**Files:**
- Create: `src/components/workspace/FocusGuard.tsx`

**Interfaces:**
- Consumes: `showInactiveAlert: boolean`, `setShowInactiveAlert`, `handleActivityDone` de `useWorkSession`
- Produces: `<FocusGuard>` — dialog que aparece tras 20 min de inactividad

- [ ] **Step 1: Crear `src/components/workspace/FocusGuard.tsx`**

```typescript
"use client";

interface Props {
  open: boolean;
  onContinue: () => void;
  onChangeActivity: () => void;
  onPause: () => void;
}

export function FocusGuard({ open, onContinue, onChangeActivity, onPause }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0F0F12] p-6 shadow-2xl">
        <div className="mb-1 text-2xl">⏸</div>
        <h2 className="mb-1 text-base font-bold text-zinc-100">¿Sigues trabajando?</h2>
        <p className="mb-5 text-sm text-zinc-500">
          Han pasado 20 minutos sin interacción detectada.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinue}
            className="w-full rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            Continuar con esta actividad
          </button>
          <button
            onClick={onChangeActivity}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800/60"
          >
            Cambiar actividad
          </button>
          <button
            onClick={onPause}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/40 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:text-zinc-300"
          >
            Pausar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/FocusGuard.tsx
git commit -m "feat(session): add FocusGuard inactivity dialog"
```

---

### Task 7: QuickNotepad + BlockReporter components

**Files:**
- Create: `src/components/workspace/QuickNotepad.tsx`
- Create: `src/components/workspace/BlockReporter.tsx`

**Interfaces:**
- Consumes: `handleAddNote(content)`, `handleAddBlock(type, description)` de `useWorkSession`; `session.notes`, `session.blocks`
- Produces: `<QuickNotepad>`, `<BlockReporter>`

- [ ] **Step 1: Crear `src/components/workspace/QuickNotepad.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { SessionNote } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  notes: SessionNote[];
  onAddNote: (content: string) => void;
}

export function QuickNotepad({ notes, onAddNote }: Props) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAddNote(text.trim());
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400">Notas rápidas</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Nueva observación..."
          className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
        />
        <button
          onClick={handleSubmit}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs font-medium text-zinc-400 transition-all hover:text-zinc-200"
        >
          Guardar
        </button>
      </div>
      {notes.length > 0 && (
        <div className="mt-3 space-y-2">
          {[...notes].reverse().map(note => (
            <div key={note.id} className="rounded-lg border border-white/[0.04] bg-zinc-900/30 px-3 py-2">
              <p className="text-[10px] text-zinc-600">
                {format(new Date(note.createdAt), "HH:mm", { locale: es })}
              </p>
              <p className="text-xs text-zinc-300">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/workspace/BlockReporter.tsx`**

```typescript
"use client";

import { useState } from "react";
import { BLOCK_LABELS } from "@/types/session";
import type { BlockType, SessionBlock } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  blocks: SessionBlock[];
  onAddBlock: (type: BlockType, description: string) => void;
}

const BLOCK_TYPES: BlockType[] = [
  "error_api",
  "acceso_faltante",
  "pendiente_cliente",
  "dependencia_externa",
];

export function BlockReporter({ blocks, onAddBlock }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<BlockType>("error_api");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!description.trim()) return;
    onAddBlock(selectedType, description.trim());
    setDescription("");
    setOpen(false);
  };

  const openBlocks = blocks.filter(b => !b.resolved);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">
          Bloqueos
          {openBlocks.length > 0 && (
            <span className="ml-2 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
              {openBlocks.length}
            </span>
          )}
        </p>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[11px] font-medium text-red-400 transition-all hover:bg-red-500/10"
        >
          + Reportar bloqueo
        </button>
      </div>

      {open && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 space-y-2">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as BlockType)}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 focus:outline-none"
          >
            {BLOCK_TYPES.map(t => (
              <option key={t} value={t}>{BLOCK_LABELS[t]}</option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
            placeholder="Describe el bloqueo..."
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-red-500/30 focus:outline-none transition-colors"
          />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all">
              Reportar
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {openBlocks.length > 0 && (
        <div className="space-y-1.5">
          {openBlocks.map(block => (
            <div key={block.id} className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-3 py-2">
              <p className="text-[10px] font-medium text-red-400">{BLOCK_LABELS[block.type]}</p>
              <p className="text-xs text-zinc-400">{block.description}</p>
              <p className="text-[10px] text-zinc-600">
                {format(new Date(block.createdAt), "HH:mm", { locale: es })}
              </p>
            </div>
          ))}
        </div>
      )}

      {blocks.length === 0 && (
        <p className="text-center py-2 text-xs text-zinc-600">Sin bloqueos reportados</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/QuickNotepad.tsx src/components/workspace/BlockReporter.tsx
git commit -m "feat(session): add QuickNotepad + BlockReporter components"
```

---

### Task 8: EndSessionDialog (confirmación + resumen)

**Files:**
- Create: `src/components/workspace/EndSessionDialog.tsx`

**Interfaces:**
- Consumes: `session: WorkSession`, `elapsed: number`, `onConfirm(deployDone, commitDone)`, `onCancel()`
- Produces: `<EndSessionDialog>` — modal con checklist deploy/commit + resumen de sesión

- [ ] **Step 1: Crear `src/components/workspace/EndSessionDialog.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { WorkSession } from "@/types/session";
import { BLOCK_LABELS } from "@/types/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  open: boolean;
  session: WorkSession;
  elapsed: number;
  onConfirm: (deployDone: boolean | null, commitDone: boolean) => void;
  onCancel: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "h:mm a", { locale: es });
  } catch { return "—"; }
}

export function EndSessionDialog({ open, session, elapsed, onConfirm, onCancel }: Props) {
  const [deployDone, setDeployDone] = useState<boolean | null>(null);
  const [commitDone, setCommitDone] = useState<boolean | null>(null);
  const [step, setStep] = useState<"checklist" | "summary">("checklist");

  if (!open) return null;

  const completedActivities = session.activities.filter(a => a.completedAt);
  const openBlocks = session.blocks.filter(b => !b.resolved);

  const handleProceed = () => {
    if (deployDone === null || commitDone === null) return;
    setStep("summary");
  };

  const handleConfirm = () => {
    onConfirm(deployDone, commitDone!);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0F0F12] shadow-2xl overflow-hidden">
        {step === "checklist" && (
          <div className="p-6">
            <h2 className="mb-1 text-base font-bold text-zinc-100">Finalizar sesión</h2>
            <p className="mb-5 text-sm text-zinc-500">Responde antes de cerrar</p>

            {/* Deploy */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">¿Realizaste deploy?</p>
              <div className="flex gap-2">
                {([true, false, null] as const).map(val => {
                  const label = val === true ? "Sí" : val === false ? "No" : "No aplica";
                  const isSelected = deployDone === val;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => setDeployDone(val)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                          : "border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commit */}
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-zinc-300">¿Realizaste commit y push?</p>
              <div className="flex gap-2">
                {([true, false] as const).map(val => {
                  const isSelected = commitDone === val;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => setCommitDone(val)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                          : "border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {val ? "Sí" : "No"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleProceed}
                disabled={deployDone === null || commitDone === null}
                className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ver resumen
              </button>
              <button onClick={onCancel} className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === "summary" && (
          <div className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <h2 className="text-sm font-bold text-zinc-100">Sesión finalizada</h2>
            </div>

            <div className="mb-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Proyecto</span>
                <span className="text-zinc-300">{session.projectName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tarea</span>
                <span className="text-zinc-300">{session.taskName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Hora inicio</span>
                <span className="text-zinc-300">{formatTime(session.startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Hora final</span>
                <span className="text-zinc-300">{formatTime(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tiempo total</span>
                <span className="font-semibold text-zinc-200">{formatElapsed(elapsed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Actividades</span>
                <span className="text-zinc-300">{completedActivities.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Notas</span>
                <span className="text-zinc-300">{session.notes.length}</span>
              </div>
              {openBlocks.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Bloqueos abiertos</span>
                  <span className="font-medium text-red-400">{openBlocks.length}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Deploy</span>
                <span className={deployDone === true ? "text-green-400" : deployDone === false ? "text-red-400" : "text-zinc-500"}>
                  {deployDone === true ? "Sí" : deployDone === false ? "No" : "No aplica"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Commit y push</span>
                <span className={commitDone ? "text-green-400" : "text-red-400"}>
                  {commitDone ? "Sí" : "No"}
                </span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
            >
              Confirmar y cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/EndSessionDialog.tsx
git commit -m "feat(session): add EndSessionDialog with deploy/commit checklist + summary"
```

---

### Task 9: SmartSidebar

**Files:**
- Create: `src/components/workspace/SmartSidebar.tsx`

**Interfaces:**
- Consumes: `project.tech: string` para comandos contextuales
- Produces: `<SmartSidebar tech={string}>` — panel derecho permanente

- [ ] **Step 1: Crear `src/components/workspace/SmartSidebar.tsx`**

```typescript
"use client";

import { useState } from "react";
import type { CRMProject } from "@/types/crm";

interface Props {
  tech: string;
}

interface Command {
  cmd: string;
  desc: string;
}

function getCommands(tech: string): Command[] {
  const t = tech.toLowerCase();
  const commands: Command[] = [];

  if (t.includes("next") || t.includes("react")) {
    commands.push(
      { cmd: "npm run dev", desc: "Inicia entorno local" },
      { cmd: "npm run build", desc: "Genera build de producción" },
      { cmd: "npm run lint", desc: "Revisa errores de código" },
    );
  }

  if (t.includes("docker")) {
    commands.push(
      { cmd: "docker compose up", desc: "Levanta servicios" },
      { cmd: "docker compose down", desc: "Detiene servicios" },
      { cmd: "docker compose logs -f", desc: "Ve los logs en vivo" },
    );
  }

  // Always include git
  commands.push(
    { cmd: "git status", desc: "Muestra cambios pendientes" },
    { cmd: "git add . && git commit -m 'msg'", desc: "Registra cambios" },
    { cmd: "git push", desc: "Sube cambios" },
  );

  return commands;
}

const DEPLOY_CHECKLIST = [
  "Build local exitoso",
  "Validación mobile",
  "Consola limpia",
  "Variables de entorno revisadas",
  "Commit realizado",
];

export function SmartSidebar({ tech }: Props) {
  const [deployChecks, setDeployChecks] = useState<Set<number>>(new Set());
  const commands = getCommands(tech);

  const toggleCheck = (i: number) => {
    setDeployChecks(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pb-6">

      {/* Buenas prácticas */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <p className="mb-2 text-xs font-semibold text-amber-400">⚠️ Recuerda</p>
        <ul className="space-y-1">
          {["Trabaja en localhost", "No modificar producción directamente", "Validar mobile antes de deploy", "Revisar consola de errores", "Revisar logs del servidor"].map(tip => (
            <li key={tip} className="flex items-start gap-1.5 text-xs text-zinc-400">
              <span className="mt-0.5 text-amber-500/70">·</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* GitHub */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-2 text-xs font-semibold text-zinc-400">💡 Buen hábito</p>
        <p className="mb-2 text-xs text-zinc-500">Haz commit frecuente. Antes de terminar:</p>
        <div className="space-y-1 font-mono text-[11px] text-zinc-400">
          <p>git status</p>
          <p>git commit -m "..."</p>
          <p>git push</p>
        </div>
      </div>

      {/* Deploy seguro */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-3 text-xs font-semibold text-zinc-400">Deploy seguro</p>
        <div className="space-y-2">
          {DEPLOY_CHECKLIST.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleCheck(i)}
              className="flex w-full items-center gap-2 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <span className={`h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                deployChecks.has(i)
                  ? "border-green-500 bg-green-500/20 text-green-400"
                  : "border-zinc-700"
              }`}>
                {deployChecks.has(i) && <span className="flex h-full items-center justify-center text-[9px]">✓</span>}
              </span>
              <span className={deployChecks.has(i) ? "line-through text-zinc-600" : ""}>{item}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comandos útiles */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-3 text-xs font-semibold text-zinc-400">
          Comandos útiles
          {tech && <span className="ml-1.5 text-zinc-600">({tech})</span>}
        </p>
        <div className="space-y-2.5">
          {commands.map((c, i) => (
            <div key={i}>
              <p className="font-mono text-[11px] text-cyan-400">{c.cmd}</p>
              <p className="text-[10px] text-zinc-600">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/SmartSidebar.tsx
git commit -m "feat(session): add SmartSidebar with best practices + deploy checklist + commands"
```

---

### Task 10: WorkspaceLayout — assemble + wire route page

**Files:**
- Create: `src/components/workspace/WorkspaceLayout.tsx`
- Modify: `src/app/(admin)/proyectos/[id]/sesion/page.tsx` (replace placeholder with WorkspaceLayout)

**Interfaces:**
- Consumes: todos los componentes de Tasks 4-9 y `useWorkSession` hook de Task 3
- Produces: experiencia completa del workspace funcional

- [ ] **Step 1: Crear `src/components/workspace/WorkspaceLayout.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkSession } from "@/types/session";
import type { CRMProject } from "@/types/crm";
import { useWorkSession } from "@/hooks/use-work-session";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { SessionTimer } from "./SessionTimer";
import { CurrentActivity } from "./CurrentActivity";
import { ActivityTimeline } from "./ActivityTimeline";
import { FocusGuard } from "./FocusGuard";
import { QuickNotepad } from "./QuickNotepad";
import { BlockReporter } from "./BlockReporter";
import { EndSessionDialog } from "./EndSessionDialog";
import { SmartSidebar } from "./SmartSidebar";

interface Props {
  sessionId: string;
  project: CRMProject;
}

export function WorkspaceLayout({ sessionId, project }: Props) {
  const router = useRouter();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const ws = useWorkSession(sessionId);

  if (!ws.session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando sesión...
      </div>
    );
  }

  const handleFinalizeConfirmed = (deployDone: boolean | null, commitDone: boolean) => {
    ws.handleEndSession(deployDone, commitDone);
    setShowEndDialog(false);
    router.push(`/proyectos/${project.id}?tab=tareas`);
  };

  return (
    <div className="flex h-full flex-col bg-[#0F0F12]">
      {/* Header */}
      <WorkspaceHeader
        session={ws.session}
        onFinalize={() => setShowEndDialog(true)}
      />

      {/* Body: main (70%) + sidebar (30%) */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Main zone */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-w-0" style={{ maxWidth: "70%" }}>
          <SessionTimer session={ws.session} elapsed={ws.elapsed} />
          <CurrentActivity
            activityText={ws.activityText}
            onChange={ws.setActivityText}
            onUpdate={ws.handleActivityUpdate}
            onDone={ws.handleActivityDone}
          />
          <ActivityTimeline activities={ws.session.activities} />
          <QuickNotepad notes={ws.session.notes} onAddNote={ws.handleAddNote} />
          <BlockReporter blocks={ws.session.blocks} onAddBlock={ws.handleAddBlock} />
        </div>

        {/* Smart sidebar */}
        <div className="w-[30%] flex-shrink-0 overflow-y-auto border-l border-white/[0.04] p-4">
          <SmartSidebar tech={project.tech ?? ""} />
        </div>
      </div>

      {/* Dialogs */}
      <FocusGuard
        open={ws.showInactiveAlert}
        onContinue={() => ws.setShowInactiveAlert(false)}
        onChangeActivity={() => {
          ws.setShowInactiveAlert(false);
          ws.handleActivityDone();
        }}
        onPause={() => ws.setShowInactiveAlert(false)}
      />

      <EndSessionDialog
        open={showEndDialog}
        session={ws.session}
        elapsed={ws.elapsed}
        onConfirm={handleFinalizeConfirmed}
        onCancel={() => setShowEndDialog(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Actualizar `src/app/(admin)/proyectos/[id]/sesion/page.tsx`**

Reemplazar el return final (el placeholder) con `WorkspaceLayout`:

Agregar import al top:
```typescript
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
```

Reemplazar el bloque final de return (el que muestra "Sesión activa: ...") con:

```typescript
  return (
    <WorkspaceLayout
      sessionId={activeSession.id}
      project={project}
    />
  );
```

- [ ] **Step 3: Verificar TypeScript completo**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -40
```

Esperado: 0 errores.

- [ ] **Step 4: Probar el flujo completo en browser**

```bash
cd /home/ubuntu/pixeltec-os && npm run dev
```

Flujo a verificar:
1. Navegar a `/proyectos/[id]?tab=tareas` — debe haber botón "▶ Iniciar sesión" en cada tarea
2. Clic en "▶ Iniciar sesión" → debe abrir `/proyectos/[id]/sesion?taskId=[tid]`
3. Header debe mostrar cliente · proyecto · tarea + "Sesión activa" verde
4. Timer debe iniciar y contar segundos
5. Escribir en "Actividad actual" → Tab/Enter → se guarda
6. Clic en "Actividad terminada" → aparece en el timeline
7. Agregar nota → aparece en lista
8. Reportar bloqueo → aparece con badge rojo
9. Clic en "Finalizar sesión" → modal con deploy/commit → "Ver resumen" → "Confirmar"
10. Redirige a `/proyectos/[id]?tab=tareas`
11. Recargar la sesión mientras está activa → timer retoma desde startedAt

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/WorkspaceLayout.tsx src/app/\(admin\)/proyectos/\[id\]/sesion/page.tsx
git commit -m "feat(session): assemble WorkspaceLayout — full work session experience"
```

---

### Task 11: Layout height fix (full-page workspace)

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

**Interfaces:**
- El workspace necesita `h-full` hasta el root para poder tener su propio scroll interno

- [ ] **Step 1: Leer el layout admin actual**

```bash
cat /home/ubuntu/pixeltec-os/src/app/\(admin\)/layout.tsx
```

- [ ] **Step 2: Verificar si el content wrapper tiene `flex-1` y `overflow-hidden`**

Si el area de contenido del layout no tiene `overflow: hidden` o `h-full`, el workspace no llenará la pantalla correctamente.

Buscar el wrapper que rodea `{children}` y verificar que tenga clases como:
- `flex-1 overflow-hidden` (para que el workspace controle su propio scroll)
- `h-full` en la cadena de elementos

Si el layout actual usa `overflow-y-auto` en el wrapper de contenido, cambiar ese wrapper a `overflow-hidden flex flex-col` para que el workspace maneje su propio scroll interno.

Si el layout no tiene este problema (el workspace ya se ve bien en pantalla completa), saltar al commit.

- [ ] **Step 3: Verificar visualmente**

El workspace debe:
- Ocupar toda la altura disponible sin scroll del body
- Tener scroll propio en la zona principal
- Header fijo en la parte superior

- [ ] **Step 4: Commit (si hubo cambios)**

```bash
git add src/app/\(admin\)/layout.tsx
git commit -m "fix(layout): allow workspace to control full-height scroll internally"
```

---

## Self-Review

### Spec coverage check

| Requisito del spec | Task |
|---|---|
| Botón "▶ Iniciar sesión de trabajo" en cada tarea | Task 2 |
| Ruta `/proyectos/[id]/sesion` o `/workspace` | Task 2 |
| Header: cliente, proyecto, tarea, estado sesión activa | Task 4 |
| Timer continuo (no Pomodoro) desde inicio de sesión | Tasks 3, 4 |
| Actividad actual editable + botón "Actualizar" | Task 5 |
| Botón "Actividad terminada" → guardar en historial | Tasks 3, 5 |
| Historial/timeline de actividades durante sesión | Task 5 |
| Detector de inactividad 20 min + diálogo | Tasks 3, 6 |
| Notas rápidas de sesión | Task 7 |
| Reportar bloqueo (tipos fijos) | Task 7 |
| Panel lateral: buenas prácticas, GitHub, deploy seguro, comandos | Task 9 |
| Finalizar sesión → confirmación deploy/commit | Task 8 |
| Resumen automático al finalizar | Task 8 |
| Historial de sesiones guardado por proyecto | Task 1 (sessions array en Firestore) |
| Layout 70/30 (main/sidebar) | Task 10 |

### Gaps identificados

- **Vista de historial de sesiones por proyecto** (tab "Resumen" del proyecto): el spec lo menciona como "vista futura" — NOT implementado, marcado como scope futuro. ✓
- **Comandos específicos por tech**: cubiertos para Next.js, Docker, Git. Si el campo `tech` está vacío, muestra solo Git. ✓
- Sin IA, sin GitHub API, sin VSCode — ✓ no implementado.
- Sin Pomodoro clásico — timer continuo ✓.

### Placeholder check

Ningún step dice "TBD" o "implementar después" — todos tienen código concreto. ✓

### Type consistency

- `WorkSession.id` → usado como `sessionId` en todos los lugares ✓
- `SessionActivity.completedAt` → `undefined` = actividad abierta; `string` = completada ✓
- `updateCurrentActivity` vs `completeActivity` — nombre consistente en Context, hook y UI ✓
- `BlockType` exportado desde `@/types/session` y usado en Context, BlockReporter, hook ✓
