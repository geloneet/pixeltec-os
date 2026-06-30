# Task Cards Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar completamente la tarjeta de tarea dentro de la vista de proyecto para que sea visualmente clara, contextual según el estado, y tenga una CTA accionable que cambie según si hay sesión activa.

**Architecture:** Se crean tres componentes nuevos (`TaskStatusDropdown`, `TaskContextCapsule`, `ProjectTaskCard`) que reemplazan el JSX inline de la lista en `ProjectView.tsx`. La vista kanban también actualiza su `KanbanCard`. Se expande el tipo `CRMTask.status` con nuevos valores y se migran los valores viejos del Firestore al cargar. No hay backend nuevo ni rutas nuevas.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui `DropdownMenu` + `Tooltip`, `date-fns` (ya instalado), Lucide icons, Radix UI (ya instalado vía shadcn).

## Global Constraints

- Todos los colores deben seguir la paleta existente: zinc-900 dark bg, cyan-400 accent, tailwind opacity utilities.
- No agregar dependencias nuevas — solo usar lo que ya existe en `package.json`.
- No tocar ningún componente de workspace (`ActivityWorkspace`, `SessionGoals`, `SessionObservations`, `WorkspaceLayout`).
- No tocar `src/app/(admin)/tareas/` (esas son las tareas del asistente personal, no las de proyectos CRM).
- La migración de datos (`"proceso"` → `"en_progreso"`, `"detenido"` → `"pausado"`) solo ocurre al leer desde Firestore, no al guardar — esto hace que la migración sea idempotente.
- No hay tests en el proyecto — verificar manualmente abriendo la vista de tareas de un proyecto.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/types/crm.ts` | Modificar | Expande `CRMTask["status"]`, actualiza `STATUS_CONFIG` con nuevos estados |
| `src/components/crm/CRMContextCore.tsx` | Modificar | Migra status viejos al cargar, actualiza `cycleTaskStatus` |
| `src/components/crm/TaskStatusDropdown.tsx` | Crear | Chip interactivo con dropdown para cambiar status |
| `src/components/crm/TaskContextCapsule.tsx` | Crear | Cápsula de "contexto de trabajo" — la firma PixelTEC |
| `src/components/crm/ProjectTaskCard.tsx` | Crear | Tarjeta de tarea completa para vista lista |
| `src/components/crm/ProjectView.tsx` | Modificar | Usa `ProjectTaskCard` en lista, actualiza `KanbanCard` |
| `src/components/crm/CRMShellProvider.tsx` | Modificar | Agrega case `"editTask"` al modal handler |

---

## Task 1: Expand CRMTask status type + STATUS_CONFIG + data migration

**Files:**
- Modify: `src/types/crm.ts:7-15` (CRMTask interface)
- Modify: `src/types/crm.ts:125-130` (STATUS_CONFIG)
- Modify: `src/components/crm/CRMContextCore.tsx:106-134` (data load)
- Modify: `src/components/crm/CRMContextCore.tsx:290-305` (cycleTaskStatus)

**Interfaces:**
- Produces: `CRMTask["status"]` con valores `"pendiente" | "en_progreso" | "en_revision" | "completado" | "pausado" | "bloqueado"`
- Produces: `STATUS_CONFIG` actualizado con los 6 estados, cada uno con `{ label, bg, text, dot }`

- [ ] **Step 1: Actualizar CRMTask interface en `src/types/crm.ts`**

Reemplazar el bloque de la interface:

```ts
export interface CRMTask {
  id: string;
  name: string;
  desc: string;
  status: "pendiente" | "en_progreso" | "en_revision" | "completado" | "pausado" | "bloqueado";
  prio: "urgent_important" | "important" | "urgent" | "low";
  createdAt: string;
  pomoSessions: number;
}
```

- [ ] **Step 2: Actualizar STATUS_CONFIG en `src/types/crm.ts`**

Reemplazar el bloque `STATUS_CONFIG`:

```ts
export const STATUS_CONFIG: Record<
  CRMTask["status"],
  { label: string; bg: string; text: string; dot: string }
> = {
  pendiente:    { label: "Pendiente",       bg: "bg-purple-500/12", text: "text-purple-400",  dot: "bg-purple-400"  },
  en_progreso:  { label: "En progreso",     bg: "bg-amber-500/12",  text: "text-amber-400",   dot: "bg-amber-400"   },
  en_revision:  { label: "En revisión",     bg: "bg-blue-500/12",   text: "text-blue-400",    dot: "bg-blue-400"    },
  completado:   { label: "Completada",      bg: "bg-green-500/12",  text: "text-green-400",   dot: "bg-green-400"   },
  pausado:      { label: "Pausada",         bg: "bg-zinc-800/60",   text: "text-zinc-400",    dot: "bg-zinc-500"    },
  bloqueado:    { label: "Bloqueada",       bg: "bg-red-500/12",    text: "text-red-400",     dot: "bg-red-400"     },
};
```

- [ ] **Step 3: Agregar helper de migración de status en `src/components/crm/CRMContextCore.tsx`**

Agregar esta función justo antes del return del componente (o como función de módulo arriba del todo):

```ts
function migrateTaskStatus(raw: string): CRMTask["status"] {
  if (raw === "proceso") return "en_progreso";
  if (raw === "detenido") return "pausado";
  const valid = ["pendiente", "en_progreso", "en_revision", "completado", "pausado", "bloqueado"];
  return valid.includes(raw) ? (raw as CRMTask["status"]) : "pendiente";
}
```

- [ ] **Step 4: Aplicar migración al cargar tasks en `CRMContextCore.tsx`**

Dentro del bloque de `loadedClients` (línea ~106), en el map de `p.tasks`, agregar el map que normaliza el status. Buscar la parte donde se procesa cada proyecto y agregar:

```ts
tasks: (p.tasks || []).map((t: any) => ({
  ...t,
  status: migrateTaskStatus(t.status ?? "pendiente"),
})),
```

El bloque completo del proyecto dentro del map debe quedar:

```ts
projects: (c.projects || []).map((p: any) => ({
  ...p,
  charges: p.charges || [],
  budget: Number(p.budget) || 0,
  annual: Number(p.annual) || 0,
  budgetIva: p.budgetIva || "none",
  annualIva: p.annualIva || "none",
  tasks: (p.tasks || []).map((t: any) => ({
    ...t,
    status: migrateTaskStatus(t.status ?? "pendiente"),
  })),
  notesLog: (() => {
    // ... bloque existente sin cambios ...
  })(),
})),
```

- [ ] **Step 5: Actualizar `cycleTaskStatus` en `CRMContextCore.tsx`**

Cambiar el array `order` para que use los nuevos valores y excluya "bloqueado" del ciclo automático:

```ts
const cycleTaskStatus = useCallback((clientId: string, projectId: string, taskId: string) => {
  const order: CRMTask["status"][] = ["pendiente", "en_progreso", "en_revision", "completado", "pausado"];
  const next = dataRef.current.clients.map(c =>
    c.id === clientId ? {
      ...c, projects: c.projects.map(p => p.id === projectId ? {
        ...p, tasks: p.tasks.map(t => {
          if (t.id !== taskId) return t;
          const idx = order.indexOf(t.status);
          const newStatus = order[(idx + 1) % order.length];
          if (newStatus === "completado") bumpStreak();
          return { ...t, status: newStatus };
        })
      } : p)
    } : c
  );
  update(next, dataRef.current.streak);
}, [update, bumpStreak]);
```

- [ ] **Step 6: Verificar que TypeScript compila sin errores**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```

Esperado: 0 errores relacionados con `status`. Si hay errores en otros archivos por el cambio de tipo (p.ej. `"proceso"` hardcodeado en algún lado), buscarlos y actualizar:

```bash
grep -rn '"proceso"\|"detenido"' src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 7: Commit**

```bash
git add src/types/crm.ts src/components/crm/CRMContextCore.tsx
git commit -m "feat(tasks): expand CRMTask status to 6 values + migrate old data"
```

---

## Task 2: EditTask modal en CRMShellProvider

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx`

**Interfaces:**
- Consumes: `modal.data` con campos `{ taskId, taskName, taskDesc, taskPrio, clientId, projectId }`
- Produces: modal type `"editTask"` que llama `crm.updateTask(clientId, projectId, taskId, { name, desc, prio })`

- [ ] **Step 1: Agregar case `"editTask"` en el switch de `handleModalSubmit`**

En `CRMShellProvider.tsx`, justo después del case `"addTask":` (línea ~221), agregar:

```ts
case "editTask": {
  if (!modal.data?.taskId || !modal.data?.clientId || !modal.data?.projectId) return;
  const name = val("name").trim();
  if (!name) return;
  crm.updateTask(modal.data.clientId, modal.data.projectId, modal.data.taskId, {
    name,
    desc: val("desc"),
    prio: val("prio") as CRMTask["prio"],
  });
  break;
}
```

- [ ] **Step 2: Agregar case `"editTask"` en el switch del contenido del modal**

En el mismo archivo, justo después del case `"addTask": {` del bloque de contenido (el que construye `content`, `title`, etc.), agregar:

```ts
case "editTask": {
  title = "Editar tarea";
  submitLabel = "Guardar cambios";
  content = (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Nombre *</label>
        <input
          ref={ref("name")}
          className={inputClass}
          placeholder="Nombre de la tarea"
          defaultValue={modal.data?.taskName || ""}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleModalSubmit();
            }
          }}
        />
      </div>
      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          ref={ref("desc")}
          className={inputClass + " h-16 resize-none"}
          defaultValue={modal.data?.taskDesc || ""}
          placeholder="Pasos, contexto o enlaces necesarios."
        />
      </div>
      <div>
        <label className={labelClass}>Prioridad</label>
        <input type="hidden" ref={ref("prio")} defaultValue={modal.data?.taskPrio || "important"} />
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {(
            [
              { value: "urgent_important", emoji: "🔴", label: "Crítica" },
              { value: "important", emoji: "🟠", label: "Importante" },
              { value: "urgent", emoji: "🟡", label: "Normal" },
              { value: "low", emoji: "🟢", label: "Baja" },
            ] as const
          ).map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              data-prio-btn={value}
              onClick={() => {
                const hidden = refs.current["prio"];
                if (hidden) (hidden as HTMLInputElement).value = value;
                document.querySelectorAll("[data-prio-btn]").forEach((el) => {
                  (el as HTMLElement).dataset.active = el.getAttribute("data-prio-btn") === value ? "true" : "false";
                });
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-center text-[10px] transition-all",
                modal.data?.taskPrio === value
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : "border-white/[0.06] bg-zinc-900/40 text-zinc-400 hover:border-white/[0.10]"
              )}
            >
              <span className="text-base">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  break;
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep -i "shellprovider\|modal" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(tasks): add editTask modal to CRMShellProvider"
```

---

## Task 3: TaskStatusDropdown component

**Files:**
- Create: `src/components/crm/TaskStatusDropdown.tsx`

**Interfaces:**
- Consumes: `status: CRMTask["status"]`, `onChange: (s: CRMTask["status"]) => void`, `disabled?: boolean`
- Produces: chip clickable que abre dropdown con los 6 estados

- [ ] **Step 1: Crear `src/components/crm/TaskStatusDropdown.tsx`**

```tsx
"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_CONFIG } from "@/types/crm";
import type { CRMTask } from "@/types/crm";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const STATUS_ORDER: CRMTask["status"][] = [
  "pendiente",
  "en_progreso",
  "en_revision",
  "completado",
  "pausado",
  "bloqueado",
];

interface TaskStatusDropdownProps {
  status: CRMTask["status"];
  onChange: (s: CRMTask["status"]) => void;
  disabled?: boolean;
}

export function TaskStatusDropdown({ status, onChange, disabled }: TaskStatusDropdownProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all active:scale-95",
            cfg.bg,
            cfg.text,
            "hover:brightness-110"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-40 border-zinc-800 bg-zinc-900 p-1 text-xs"
      >
        {STATUS_ORDER.map((s) => {
          const c = STATUS_CONFIG[s];
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => onChange(s)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                s === status
                  ? cn(c.bg, c.text, "font-medium")
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", c.dot)} />
              {c.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep -i "statusdropdown" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/TaskStatusDropdown.tsx
git commit -m "feat(tasks): add TaskStatusDropdown interactive chip"
```

---

## Task 4: TaskContextCapsule component

**Files:**
- Create: `src/components/crm/TaskContextCapsule.tsx`

**Interfaces:**
- Consumes: `task: CRMTask`, `sessions: WorkSession[]`
- Produces: `<span>` con el contexto de trabajo contextual — la "firma PixelTEC"

- [ ] **Step 1: Crear `src/components/crm/TaskContextCapsule.tsx`**

```tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { CRMTask } from "@/types/crm";
import type { WorkSession } from "@/types/session";
import { cn } from "@/lib/utils";

interface Props {
  task: CRMTask;
  sessions: WorkSession[];
  className?: string;
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function relativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { locale: es, addSuffix: true });
  } catch {
    return "—";
  }
}

export function TaskContextCapsule({ task, sessions, className }: Props) {
  const taskSessions = sessions.filter((s) => s.taskId === task.id);
  const activeSession = taskSessions.find((s) => s.status === "active");
  const completedSessions = taskSessions.filter((s) => s.status === "completed");
  const totalSeconds = completedSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);
  const lastSession = completedSessions
    .slice()
    .sort((a, b) => new Date(b.endedAt ?? b.startedAt).getTime() - new Date(a.endedAt ?? a.startedAt).getTime())[0];

  // Active session: always highest priority
  if (activeSession) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[11px] text-green-400", className)}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
        </span>
        Trabajando ahora
      </span>
    );
  }

  if (task.status === "completado") {
    return (
      <span className={cn("text-[11px] text-zinc-500", className)}>
        {totalSeconds > 0 ? `Finalizada · ${fmtDuration(totalSeconds)} invertidas` : "Finalizada"}
      </span>
    );
  }

  if (task.status === "bloqueado") {
    return (
      <span className={cn("text-[11px] text-red-400/80", className)}>
        Bloqueada
      </span>
    );
  }

  if (task.status === "en_revision") {
    return (
      <span className={cn("text-[11px] text-blue-400/80", className)}>
        Lista para revisión
      </span>
    );
  }

  if (task.status === "pausado") {
    return (
      <span className={cn("text-[11px] text-zinc-500", className)}>
        {lastSession
          ? `Pausada · última sesión ${relativeTime(lastSession.endedAt ?? lastSession.startedAt)}`
          : "Pausada"}
      </span>
    );
  }

  // pendiente / en_progreso — mostrar contexto de retoma
  if (lastSession) {
    return (
      <span className={cn("text-[11px] text-amber-400/80", className)}>
        Retomar · última sesión {relativeTime(lastSession.endedAt ?? lastSession.startedAt)}
      </span>
    );
  }

  return (
    <span className={cn("text-[11px] text-zinc-600", className)}>
      Sin iniciar
    </span>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep -i "capsule" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/TaskContextCapsule.tsx
git commit -m "feat(tasks): add TaskContextCapsule — work-context signature"
```

---

## Task 5: ProjectTaskCard component (lista view)

**Files:**
- Create: `src/components/crm/ProjectTaskCard.tsx`

**Interfaces:**
- Consumes: `task: CRMTask`, `clientId: string`, `projectId: string`, `projectId: string`, `sessions: WorkSession[]`, `onUpdateStatus: (s: CRMTask["status"]) => void`, `onStartSession: () => void`, `onEdit: () => void`, `onDelete: () => void`
- Produces: componente de tarjeta completa para la vista lista

Lógica del CTA principal:
- `activeSession` existe → `"Abrir sesión →"` (navega a la sesión activa, no "iniciar")
- `completado` → sin CTA
- `bloqueado` → sin CTA
- `en_revision` → sin CTA (o texto informativo)
- `en_progreso` + sin sesión activa → `"▶ Continuar sesión"`
- `pausado` + sin sesión activa → `"▶ Reanudar"`
- `pendiente` → `"▶ Iniciar sesión"`

- [ ] **Step 1: Crear `src/components/crm/ProjectTaskCard.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { useCRM } from "./CRMContextCore";
import { TaskStatusDropdown } from "./TaskStatusDropdown";
import { TaskContextCapsule } from "./TaskContextCapsule";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITIES } from "@/types/crm";
import type { CRMTask } from "@/types/crm";
import type { WorkSession } from "@/types/session";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ProjectTaskCardProps {
  task: CRMTask;
  clientId: string;
  projectId: string;
  sessions: WorkSession[];
  onUpdateStatus: (s: CRMTask["status"]) => void;
  onStartSession: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

export function ProjectTaskCard({
  task,
  sessions,
  onUpdateStatus,
  onStartSession,
  onEdit,
  onDelete,
}: ProjectTaskCardProps) {
  const taskSessions = useMemo(
    () => sessions.filter((s) => s.taskId === task.id),
    [sessions, task.id]
  );
  const activeSession = taskSessions.find((s) => s.status === "active");
  const completedSessions = taskSessions.filter((s) => s.status === "completed");
  const totalSeconds = completedSessions.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);

  const isCompleted = task.status === "completado";
  const isBlocked = task.status === "bloqueado";
  const isReview = task.status === "en_revision";
  const hideCTA = isCompleted || isBlocked || isReview;

  const ctaLabel = activeSession
    ? "Abrir sesión →"
    : task.status === "en_progreso"
    ? "▶ Continuar"
    : task.status === "pausado"
    ? "▶ Reanudar"
    : "▶ Iniciar sesión";

  const statsLine = [
    completedSessions.length > 0 && `${completedSessions.length} sesión${completedSessions.length !== 1 ? "es" : ""}`,
    totalSeconds > 0 && fmtDuration(totalSeconds),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "group rounded-xl border border-white/[0.06] bg-zinc-900/20 px-4 py-3.5 transition-all hover:border-white/[0.10]",
        isCompleted && "opacity-40"
      )}
    >
      {/* Row 1: priority dot + name + ⋮ menu */}
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: PRIORITIES[task.prio].color }}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium text-zinc-200 leading-snug",
              isCompleted && "line-through"
            )}
          >
            {task.name}
          </p>
          {task.desc && (
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{task.desc}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-36 border-zinc-800 bg-zinc-900 p-1 text-xs"
          >
            <DropdownMenuItem
              onClick={onEdit}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 border-zinc-800" />
            <DropdownMenuItem
              onClick={onDelete}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: capsule + stats */}
      <div className="mt-2 flex items-center gap-3 pl-[18px]">
        <TaskContextCapsule task={task} sessions={sessions} />
        {statsLine && (
          <span className="text-[10px] text-zinc-700">{statsLine}</span>
        )}
      </div>

      {/* Row 3: status chip + CTA */}
      <div className="mt-3 flex items-center justify-between pl-[18px]">
        <TaskStatusDropdown status={task.status} onChange={onUpdateStatus} />
        {!hideCTA && (
          <button
            onClick={onStartSession}
            className={cn(
              "rounded-lg border px-3 py-1 text-[11px] font-medium transition-all hover:brightness-110 whitespace-nowrap",
              activeSession
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-400 hover:bg-cyan-500/20"
            )}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep -i "taskcard" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/ProjectTaskCard.tsx
git commit -m "feat(tasks): add ProjectTaskCard with state-aware CTA and context capsule"
```

---

## Task 6: Integrar en ProjectView.tsx (lista + kanban)

**Files:**
- Modify: `src/components/crm/ProjectView.tsx:77-123` (KanbanCard)
- Modify: `src/components/crm/ProjectView.tsx:472-512` (lista view)

**Interfaces:**
- Consumes: `ProjectTaskCard`, `TaskStatusDropdown`, `TaskContextCapsule`
- Consumes: `crm.sessions` (del useCRM() ya llamado en el componente)
- Consumes: `crm.updateTask(clientId, projectId, taskId, { status })` para cambios directos de status

**Nota importante:** `ProjectView.tsx` ya llama `useCRM()` en la línea 167 (`const crm = useCRM()`). Se puede acceder a `crm.sessions` directamente. Para el `onUpdateStatus`, usaremos `crm.updateTask` en lugar de `cycleTaskStatus`.

- [ ] **Step 1: Actualizar imports en `ProjectView.tsx`**

Agregar los tres nuevos imports:

```ts
import { ProjectTaskCard } from "./ProjectTaskCard";
import { TaskStatusDropdown } from "./TaskStatusDropdown";
import { TaskContextCapsule } from "./TaskContextCapsule";
```

Remover `STATUS_CONFIG` del import de `@/types/crm` si ya no se usa en la lista (todavía lo usa KanbanCard — verificar antes de remover).

- [ ] **Step 2: Reemplazar la vista lista (líneas 471-513 aprox)**

Reemplazar el bloque `{taskView === "lista" && (...)}` completo:

```tsx
{/* Lista view */}
{taskView === "lista" && (
  <div className="space-y-2">
    {sortedTasks.length === 0 && (
      <p className="py-10 text-center text-sm text-zinc-500">No hay tareas</p>
    )}
    {sortedTasks.map((task) => (
      <ProjectTaskCard
        key={task.id}
        task={task}
        clientId={client.id}
        projectId={project.id}
        sessions={crm.sessions}
        onUpdateStatus={(s) => crm.updateTask(client.id, project.id, task.id, { status: s })}
        onStartSession={() => handleStartSession(task.id)}
        onEdit={() =>
          setModal({
            type: "editTask",
            data: {
              taskId: task.id,
              taskName: task.name,
              taskDesc: task.desc,
              taskPrio: task.prio,
              clientId: client.id,
              projectId: project.id,
            },
          })
        }
        onDelete={() => deleteTask(client.id, project.id, task.id)}
      />
    ))}
  </div>
)}
```

- [ ] **Step 3: Actualizar KanbanCard para usar los nuevos componentes**

Reemplazar el componente `KanbanCard` completo (líneas 79-123) con esta versión actualizada:

```tsx
function KanbanCard({
  task,
  clientId,
  projectId,
  sessions,
  cycleTaskStatus,
  deleteTask,
  onStartSession,
  setModal,
}: KanbanCardProps & { sessions: WorkSession[]; setModal: (m: { type: string; data?: Record<string, string> } | null) => void }) {
  const isCompleted = task.status === "completado";
  const isBlocked = task.status === "bloqueado";
  const activeSession = sessions.find((s) => s.taskId === task.id && s.status === "active");

  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.06] bg-zinc-900/30 p-3 space-y-2.5 transition-colors hover:border-white/[0.10]",
        isCompleted && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: PRIORITIES[task.prio].color }}
        />
        <p className={cn("flex-1 text-xs font-medium text-zinc-200 leading-snug", isCompleted && "line-through")}>
          {task.name}
        </p>
      </div>
      {task.desc && <p className="truncate pl-3.5 text-[10px] text-zinc-500">{task.desc}</p>}

      <div className="pl-3.5">
        <TaskContextCapsule task={task} sessions={sessions} />
      </div>

      <div className="flex items-center justify-between pl-3.5">
        <TaskStatusDropdown
          status={task.status}
          onChange={(s) => {/* handled via updateTask in parent */}}
          disabled
        />
        {!isCompleted && !isBlocked && (
          <button
            onClick={() => onStartSession(task.id)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap",
              activeSession ? "text-green-400 hover:bg-green-500/10" : "text-cyan-400 hover:bg-cyan-500/10"
            )}
          >
            {activeSession ? "Abrir →" : "▶ Sesión"}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Nota:** El KanbanCard recibe `sessions` como prop nueva. Actualizar `KanbanCardProps` y el lugar donde se renderiza el `KanbanCard` en el kanban view para pasar `sessions={crm.sessions}` y `setModal={setModal}`.

Actualizar `KanbanCardProps`:

```ts
interface KanbanCardProps {
  task: CRMTask;
  clientId: string;
  projectId: string;
  sessions: WorkSession[];
  cycleTaskStatus: (cid: string, pid: string, tid: string) => void;
  deleteTask: (cid: string, pid: string, tid: string) => void;
  onStartSession: (taskId: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}
```

Actualizar el render del KanbanCard (en el map del kanban view):

```tsx
<KanbanCard
  key={task.id}
  task={task}
  clientId={client.id}
  projectId={project.id}
  sessions={crm.sessions}
  cycleTaskStatus={cycleTaskStatus}
  deleteTask={deleteTask}
  onStartSession={handleStartSession}
  setModal={setModal}
/>
```

- [ ] **Step 4: Agregar import de WorkSession al top del archivo**

```ts
import type { WorkSession } from "@/types/session";
```

- [ ] **Step 5: Verificar TypeScript completo**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -40
```

Esperado: 0 errores. Si hay errores de tipo en el modal data (Record<string, string> vs campos tipados), ajustar el cast de `modal.data` según sea necesario.

- [ ] **Step 6: Levantar el dev server y verificar manualmente**

```bash
cd /home/ubuntu/pixeltec-os && npm run dev
```

Abrir `http://localhost:3000/proyectos/[id]?tab=tareas` y verificar:
- [ ] Vista lista: cada tarea muestra el nombre, descripción, cápsula de contexto, dropdown de status, CTA correcta
- [ ] Click en status chip abre dropdown con 6 opciones
- [ ] Cambiar status actualiza la tarjeta visualmente
- [ ] Tarea completada: opaca, sin CTA
- [ ] Tarea bloqueada: sin CTA
- [ ] ⋮ menu aparece al hover, tiene Editar y Eliminar
- [ ] Click en Editar abre el modal editTask con datos pre-rellenados
- [ ] Click en Eliminar elimina la tarea
- [ ] Vista kanban: las tarjetas tienen la cápsula y el CTA contextual
- [ ] El botón de sesión dice "Abrir →" si hay sesión activa para esa tarea
- [ ] Tarea que ya tiene sesiones muestra "Retomar · última sesión hace X" en la cápsula

- [ ] **Step 7: Commit final**

```bash
git add src/components/crm/ProjectView.tsx
git commit -m "feat(tasks): integrate ProjectTaskCard into ProjectView lista + kanban"
```

---

## Self-Review

**Spec coverage check:**

| Idea de Miguel | Task |
|----------------|------|
| Status como chip interactivo con dropdown | Task 3 |
| 6 estados nuevos (incluye Bloqueada, En revisión) | Task 1 |
| Card cambia según estado (CTA diferente) | Task 5 |
| "Trabajando ahora" cuando hay sesión activa | Task 4 |
| Stats en tarjeta (N sesiones · Xh) | Task 5 |
| Cápsula de contexto "¿Qué debo hacer ahora?" | Task 4 |
| ⋮ menu en lugar de ✕ | Task 5 |
| Editar tarea desde el menú | Task 2 + 5 |
| Eliminar desde menú (no ✕ directo) | Task 5 |
| Vista kanban también mejora | Task 6 |

**Placeholder scan:** ninguno.

**Type consistency:**
- `CRMTask["status"]` con 6 valores → definido en Task 1, usado en Task 3, 4, 5, 6. ✓
- `STATUS_CONFIG[status].dot` → definido en Task 1, usado en Task 3. ✓
- `sessions` → tipo `WorkSession[]`, pasado como prop en Task 5 y 6. ✓
- `onUpdateStatus: (s: CRMTask["status"]) => void` → definido en Task 5 interface, implementado en Task 6. ✓

**Notas para el implementador:**
- El KanbanCard en Task 6 tiene el `TaskStatusDropdown` con `disabled={true}` porque el kanban aún no tiene implementado el handler directo de `updateTask` en el prop drilling. Se puede habilitar agregando `onUpdateStatus` como prop al KanbanCard — tarea pequeña de seguimiento si se necesita.
- La migración del status es **lazy** (solo al cargar desde Firestore), nunca al guardar. Esto es intencional para que sea idempotente.
- `crm.sessions` incluye todas las sesiones del usuario, no solo del proyecto. El filtro `s.taskId === task.id` dentro de `TaskContextCapsule` y `ProjectTaskCard` hace el filtrado correcto.
