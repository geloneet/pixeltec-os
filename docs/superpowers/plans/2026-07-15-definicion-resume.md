# Retomar "Definición de Proyecto" desde ficha de cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en la ficha del cliente las definiciones de proyecto en curso (con
botón "Continuar"), y no perder texto sin guardar en los dos formularios del pipeline.

**Architecture:** Espeja patrones ya existentes en el mismo repo — una query hermana
de `listDefinitionsByOwner`, un fetch-on-mount igual al de `ContratosTab`, y
autoguardado con `useRef`+`setTimeout` (mismo estilo que `CRMContextCore`). Sin
librerías nuevas, sin migraciones de esquema.

**Tech Stack:** Next.js App Router, React (client components), Drizzle ORM /
Postgres, Vitest + Testing Library (jsdom).

## Global Constraints

- Spec de referencia (aprobada): `docs/superpowers/specs/2026-07-15-definicion-resume-design.md` (commit `7cd94d5`).
- Sin migraciones de esquema — todo lee columnas/índices ya existentes (`project_definitions_client_idx`).
- Sin dependencias nuevas — el debounce se implementa a mano (`useRef<ReturnType<typeof setTimeout>>` + `setTimeout`), mismo patrón que `src/components/crm/CRMContextCore.tsx:105-223`. No se introduce un hook `useDebounce` genérico.
- "Definición sin terminar" = `status !== "completed"`; si hay varias, se usa la de `updatedAt` más reciente (confirmado en la spec, sección Auto-revisión).
- Este repo no tiene precedente de tests automatizados contra Drizzle/Postgres ni de tests de server actions con `auth()` mockeado (cero archivos `*.test.ts` tocan `db` o `actions.ts` en todo `src/`). Las Tareas 2 y 3 (repo query y server action) **no** llevan test automatizado por esta razón — se verifican manualmente en dev (Tarea 8), igual que su hermana `listDefinitionsByOwner` no tiene test propio hoy. Esto es una desviación consciente de la spec (que pedía "test de repo" / "test de autorización") documentada aquí en vez de inventar infraestructura de mocking de DB que no existe en el resto del código.
- Los tests de componentes usan el patrón ya establecido en `src/app/(admin)/vps/components/action-bar.test.tsx`: `// @vitest-environment jsdom` + `@testing-library/react` + `vi.hoisted`/`vi.mock` para las dependencias externas (server actions, `next/navigation`).
- Comentarios y copy de UI en español, consistente con el resto del código.

---

### Task 1: Helper puro `pickContinuableDefinition`

**Files:**
- Create: `src/lib/definition/continuable.ts`
- Test: `src/lib/definition/continuable.test.ts`

**Interfaces:**
- Produces: `pickContinuableDefinition<T extends ContinuableDefinition>(definitions: T[]): T | null` y el tipo `ContinuableDefinition { id: string; status: "draft" | "in_progress" | "completed"; updatedAt: Date }`. Tarea 5 (`ProyectosTab`) llama esta función pasándole `DefinitionListItem[]` (que ya cumple esta forma).

- [ ] **Step 1: Escribir el test que falla**

```typescript
// src/lib/definition/continuable.test.ts
import { describe, expect, it } from "vitest";
import { pickContinuableDefinition } from "./continuable";

function def(id: string, status: "draft" | "in_progress" | "completed", updatedAt: string) {
  return { id, status, updatedAt: new Date(updatedAt) };
}

describe("pickContinuableDefinition", () => {
  it("devuelve null si la lista está vacía", () => {
    expect(pickContinuableDefinition([])).toBeNull();
  });

  it("devuelve null si todas están completed", () => {
    const list = [def("a", "completed", "2026-07-01"), def("b", "completed", "2026-07-10")];
    expect(pickContinuableDefinition(list)).toBeNull();
  });

  it("devuelve la única definición sin terminar", () => {
    const list = [def("a", "completed", "2026-07-01"), def("b", "draft", "2026-07-05")];
    expect(pickContinuableDefinition(list)?.id).toBe("b");
  });

  it("con varias sin terminar, devuelve la de updatedAt más reciente", () => {
    const list = [
      def("a", "in_progress", "2026-07-01"),
      def("b", "draft", "2026-07-10"),
      def("c", "in_progress", "2026-07-05"),
    ];
    expect(pickContinuableDefinition(list)?.id).toBe("b");
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/lib/definition/continuable.test.ts`
Expected: FAIL — `Cannot find module './continuable'` (o similar, el archivo no existe todavía).

- [ ] **Step 3: Implementación mínima**

```typescript
// src/lib/definition/continuable.ts
/**
 * Elige, de una lista de definiciones, cuál ofrecer para "Continuar" en la
 * ficha del cliente: la más reciente entre las que no están `completed`.
 * Puro, sin dependencias de DB — reusable en componentes cliente y tests.
 */
export interface ContinuableDefinition {
  id: string;
  status: "draft" | "in_progress" | "completed";
  updatedAt: Date;
}

export function pickContinuableDefinition<T extends ContinuableDefinition>(
  definitions: T[]
): T | null {
  const unfinished = definitions.filter((d) => d.status !== "completed");
  if (unfinished.length === 0) return null;
  return unfinished.reduce((latest, d) =>
    d.updatedAt.getTime() > latest.updatedAt.getTime() ? d : latest
  );
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/lib/definition/continuable.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/definition/continuable.ts src/lib/definition/continuable.test.ts
git commit -m "feat(definicion): helper puro para elegir la definición a continuar"
```

---

### Task 2: Repo — `listDefinitionsByClient`

**Files:**
- Modify: `src/lib/db/repos/definitions.ts:117-137` (junto a `listDefinitionsByOwner`)

**Interfaces:**
- Consumes: `DefinitionListItem` (ya definido en este archivo, `definitions.ts:105-115`).
- Produces: `listDefinitionsByClient(clientId: string, ownerId: string): Promise<DefinitionListItem[]>`. Tarea 3 (server action) es su único caller.

- [ ] **Step 1: Agregar la función junto a `listDefinitionsByOwner`**

En `src/lib/db/repos/definitions.ts`, inmediatamente después del cierre de
`listDefinitionsByOwner` (línea 137, `}`), agregar:

```typescript
/** Lista de definiciones de UN cliente, escopada por owner. Orden por updatedAt desc. */
export function listDefinitionsByClient(
  clientId: string,
  ownerId: string
): Promise<DefinitionListItem[]> {
  return db
    .select({
      id: projectDefinitions.id,
      title: projectDefinitions.title,
      clientId: projectDefinitions.clientId,
      clientName: clients.name,
      currentStation: projectDefinitions.currentStation,
      status: projectDefinitions.status,
      proposalId: projectDefinitions.proposalId,
      updatedAt: projectDefinitions.updatedAt,
      createdAt: projectDefinitions.createdAt,
    })
    .from(projectDefinitions)
    .leftJoin(clients, eq(projectDefinitions.clientId, clients.id))
    .where(
      and(
        eq(projectDefinitions.clientId, clientId),
        eq(projectDefinitions.ownerId, ownerId)
      )
    )
    .orderBy(desc(projectDefinitions.updatedAt));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores nuevos (el archivo ya importa `and`, `eq`, `desc`, `clients`, `projectDefinitions` — no hace falta agregar imports).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/repos/definitions.ts
git commit -m "feat(definicion): query listDefinitionsByClient"
```

---

### Task 3: Server action `listClientDefinitionsAction`

**Files:**
- Modify: `src/app/(admin)/proyectos/definicion/actions.ts`

**Interfaces:**
- Consumes: `listDefinitionsByClient` (Tarea 2), `requireAuth()` (ya existe en este archivo, línea 40), `DefinitionListItem` (tipo de `@/lib/db/repos/definitions`).
- Produces: `listClientDefinitionsAction(clientCrmId: string): Promise<PortalActionResult<{ definitions: DefinitionListItem[] }>>` y el helper interno `resolveClientByCrmId(ownerId: string, clientCrmId: string)`. Tarea 5 (`ProyectosTab`) es el único caller de la acción.

- [ ] **Step 1: Extraer `resolveClientByCrmId` de la lógica ya existente en `createDefinitionAction`**

En `createDefinitionAction` (líneas 66-83 de `actions.ts`) hoy se resuelve
`clientCrmId` inline. Se extrae a una función compartida para no duplicarla en la
acción nueva. Reemplazar el bloque:

```typescript
    // El id que manda el workspace es `firestoreId ?? pgId` (ver getFullCrmData).
    // `clients.id` es uuid en Postgres: si clientCrmId es un id viejo de Firestore
    // (no-uuid), comparar contra esa columna en la misma query revienta el bind
    // del parámetro antes de evaluar el OR (mismo caso que getPostById).
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clientCrmId
    );
    const client = await db
      .select({ id: clients.id, firestoreId: clients.firestoreId })
      .from(clients)
      .where(
        and(
          eq(clients.ownerId, ownerId),
          isUuid
            ? or(eq(clients.firestoreId, clientCrmId), eq(clients.id, clientCrmId))
            : eq(clients.firestoreId, clientCrmId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!client) return { success: false, error: "Cliente no encontrado" };
```

por:

```typescript
    const client = await resolveClientByCrmId(ownerId, clientCrmId);
    if (!client) return { success: false, error: "Cliente no encontrado" };
```

Y agregar la función extraída antes de `export async function createDefinitionAction`
(después de `requireAuth`, línea 46):

```typescript
/**
 * Resuelve el id interno de Postgres (`clients.id`) a partir del id que manda
 * el workspace CRM (`firestoreId ?? pgId`, ver getFullCrmData). `clients.id` es
 * uuid: si `clientCrmId` no tiene forma de uuid, comparar contra esa columna en
 * la misma query revienta el bind del parámetro antes de evaluar el OR (mismo
 * caso que getPostById) — por eso el chequeo `isUuid` antes de armar el OR.
 */
async function resolveClientByCrmId(ownerId: string, clientCrmId: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    clientCrmId
  );
  return db
    .select({ id: clients.id, firestoreId: clients.firestoreId })
    .from(clients)
    .where(
      and(
        eq(clients.ownerId, ownerId),
        isUuid
          ? or(eq(clients.firestoreId, clientCrmId), eq(clients.id, clientCrmId))
          : eq(clients.firestoreId, clientCrmId)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
```

- [ ] **Step 2: Typecheck tras la extracción (antes de agregar la acción nueva)**

Run: `npm run typecheck`
Expected: sin errores — `createDefinitionAction` debe seguir funcionando idéntico, solo delega a la función extraída.

- [ ] **Step 3: Agregar `listClientDefinitionsAction`**

Agregar el import de `listDefinitionsByClient` y `DefinitionListItem` junto a los
imports existentes de `@/lib/db/repos/definitions` (línea 14-24):

```typescript
import {
  createDefinition,
  startDefinition,
  updateDraft,
  getDefinition,
  getDefinitionFull,
  sealStation,
  reopenStation,
  attachProposal,
  listDefinitionsByClient,
  type Actor,
  type DefinitionListItem,
} from "@/lib/db/repos/definitions";
```

Agregar la acción al final del archivo:

```typescript
/** Definiciones de un cliente para la sección "Definiciones" en ProyectosTab. */
export async function listClientDefinitionsAction(
  clientCrmId: string
): Promise<PortalActionResult<{ definitions: DefinitionListItem[] }>> {
  try {
    const { ownerId } = await requireAuth();
    const client = await resolveClientByCrmId(ownerId, clientCrmId);
    if (!client) return { success: false, error: "Cliente no encontrado" };

    const definitions = await listDefinitionsByClient(client.id, ownerId);
    return { success: true, data: { definitions } };
  } catch (err) {
    console.error("[listClientDefinitionsAction]", err);
    return { success: false, error: "No se pudieron cargar las definiciones" };
  }
}
```

- [ ] **Step 4: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/proyectos/definicion/actions.ts
git commit -m "feat(definicion): server action listClientDefinitionsAction"
```

---

### Task 4: `DefinitionStatusBadge` — extraer y reusar

**Files:**
- Create: `src/components/definition/DefinitionStatusBadge.tsx`
- Test: `src/components/definition/DefinitionStatusBadge.test.tsx`
- Modify: `src/app/(admin)/proyectos/definicion/page.tsx:48-93`

**Interfaces:**
- Consumes: `getStationMeta` (`@/lib/definition/station-meta`), `cn` (`@/lib/utils`), `DefinitionStation` (`@/lib/definition/types`).
- Produces: `DefinitionStatusBadge({ status, currentStation }: { status: "draft" | "in_progress" | "completed"; currentStation: DefinitionStation })`. Consumido por `page.tsx` (este task) y por `ProyectosTab` (Tarea 5).

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
// src/components/definition/DefinitionStatusBadge.test.tsx
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DefinitionStatusBadge } from "./DefinitionStatusBadge";

describe("DefinitionStatusBadge", () => {
  it("muestra 'Completo' cuando status es completed", () => {
    render(<DefinitionStatusBadge status="completed" currentStation="flujo" />);
    expect(screen.getByText("Completo")).toBeInTheDocument();
  });

  it("muestra 'Borrador' cuando status es draft, sin importar la estación", () => {
    render(<DefinitionStatusBadge status="draft" currentStation="boceto" />);
    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("muestra el stepLabel de la estación actual cuando está in_progress", () => {
    render(<DefinitionStatusBadge status="in_progress" currentStation="mvp" />);
    expect(screen.getByText("MVP")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Confirmar el stepLabel exacto de la estación "mvp"**

Run: `grep -A3 'id: "mvp"' src/lib/definition/station-meta.ts`
Expected: el objeto de esa estación trae `stepLabel: "MVP"` (si el valor real es
distinto, usar ese valor literal en el test del Step 1 antes de seguir).

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx vitest run src/components/definition/DefinitionStatusBadge.test.tsx`
Expected: FAIL — `Cannot find module './DefinitionStatusBadge'`.

- [ ] **Step 4: Implementación — extraer el markup ya existente en `page.tsx:66-92`**

```tsx
// src/components/definition/DefinitionStatusBadge.tsx
import { CheckCircle2, FileEdit } from "lucide-react";
import { getStationMeta } from "@/lib/definition/station-meta";
import { cn } from "@/lib/utils";
import type { DefinitionStation } from "@/lib/definition/types";

interface Props {
  status: "draft" | "in_progress" | "completed";
  currentStation: DefinitionStation;
}

/** Badge de estado de una definición: Completo / Borrador / estación actual. */
export function DefinitionStatusBadge({ status, currentStation }: Props) {
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
        <CheckCircle2 className="h-3 w-3" />
        Completo
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
        <FileEdit className="h-3 w-3" />
        Borrador
      </span>
    );
  }
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", "bg-muted text-muted-foreground")}>
      {getStationMeta(currentStation).stepLabel}
    </span>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run src/components/definition/DefinitionStatusBadge.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Refactorizar `page.tsx` para reusar el badge (sin cambio visual)**

En `src/app/(admin)/proyectos/definicion/page.tsx`, quitar los imports ya no usados
`CheckCircle2, FileEdit` de la línea 4 (dejar `Sparkles, FileText`), agregar:

```typescript
import { DefinitionStatusBadge } from "@/components/definition/DefinitionStatusBadge";
```

Reemplazar el bloque completo (líneas 48-50 y 66-92 del archivo original — el
`const completed = ...` / `const isDraft = ...` / `const meta = ...` y el JSX
condicional del badge) por:

```tsx
          {definitions.map((d) => {
            return (
              <Link
                key={d.id}
                href={`/proyectos/definicion/${d.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/40"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-cyan-300" strokeWidth={1.75} />
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    {d.title}
                  </h2>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {d.clientName ?? "Cliente"}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <DefinitionStatusBadge status={d.status} currentStation={d.currentStation} />
                  {d.proposalId && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <FileText className="h-3 w-3" />
                      Propuesta generada
                    </span>
                  )}
                </div>
```

(el resto del archivo — fecha relativa, cierre del `Link`, cierre del `.map` — queda
igual, sin tocar).

- [ ] **Step 7: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores — confirma que no quedaron imports huérfanos (`CheckCircle2`,
`FileEdit`, `cn` si ya no se usan directo en `page.tsx`).

- [ ] **Step 8: Commit**

```bash
git add src/components/definition/DefinitionStatusBadge.tsx src/components/definition/DefinitionStatusBadge.test.tsx "src/app/(admin)/proyectos/definicion/page.tsx"
git commit -m "refactor(definicion): extraer DefinitionStatusBadge, reusar en el listado global"
```

---

### Task 5: `ProyectosTab` — sección "Definiciones" + botón "Continuar"

**Files:**
- Modify: `src/components/crm/workspace-tabs/ProyectosTab.tsx`
- Test: `src/components/crm/workspace-tabs/ProyectosTab.test.tsx`

**Interfaces:**
- Consumes: `listClientDefinitionsAction` (Tarea 3), `DefinitionListItem` (`@/lib/db/repos/definitions`), `pickContinuableDefinition` (Tarea 1), `DefinitionStatusBadge` (Tarea 4).
- Produces: sin cambio de props públicas de `ProyectosTab` (sigue recibiendo `{ client, navigateToProject, setModal }`).

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
// src/components/crm/workspace-tabs/ProyectosTab.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { CRMClient } from "@/types/crm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { listClientDefinitionsActionMock } = vi.hoisted(() => ({
  listClientDefinitionsActionMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/definicion/actions", () => ({
  listClientDefinitionsAction: listClientDefinitionsActionMock,
}));

import { ProyectosTab } from "./ProyectosTab";

function buildClient(overrides: Partial<CRMClient> = {}): CRMClient {
  return {
    id: "client-1",
    name: "Cliente de prueba",
    email: "cliente@example.com",
    phone: "555-0000",
    location: "CDMX",
    notes: "",
    projects: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProyectosTab — sección Definiciones", () => {
  it("no muestra la sección si no hay definiciones", async () => {
    listClientDefinitionsActionMock.mockResolvedValue({ success: true, data: { definitions: [] } });
    render(<ProyectosTab client={buildClient()} navigateToProject={vi.fn()} setModal={vi.fn()} />);

    await waitFor(() => expect(listClientDefinitionsActionMock).toHaveBeenCalledWith("client-1"));
    expect(screen.queryByText("Definiciones")).not.toBeInTheDocument();
    expect(screen.getByText("Nuevo Proyecto")).toBeInTheDocument();
  });

  it("muestra 'Continuar <título>' cuando hay una definición sin terminar", async () => {
    listClientDefinitionsActionMock.mockResolvedValue({
      success: true,
      data: {
        definitions: [
          {
            id: "def-1",
            title: "Rediseño del portal",
            clientId: "client-1",
            clientName: "Cliente de prueba",
            currentStation: "mvp",
            status: "in_progress",
            proposalId: null,
            updatedAt: new Date("2026-07-15T10:00:00.000Z"),
            createdAt: new Date("2026-07-10T10:00:00.000Z"),
          },
        ],
      },
    });

    render(<ProyectosTab client={buildClient()} navigateToProject={vi.fn()} setModal={vi.fn()} />);

    expect(await screen.findByText("Definiciones")).toBeInTheDocument();
    expect(screen.getByText("Rediseño del portal")).toBeInTheDocument();
    const continueLink = screen.getByRole("link", { name: /Continuar Rediseño del portal/i });
    expect(continueLink).toHaveAttribute("href", "/proyectos/definicion/def-1");
    expect(screen.getByRole("link", { name: "Nuevo Proyecto" })).toBeInTheDocument();
  });

  it("mantiene 'Nuevo Proyecto' como botón principal si todas las definiciones están completas", async () => {
    listClientDefinitionsActionMock.mockResolvedValue({
      success: true,
      data: {
        definitions: [
          {
            id: "def-1",
            title: "Ya terminado",
            clientId: "client-1",
            clientName: "Cliente de prueba",
            currentStation: "flujo",
            status: "completed",
            proposalId: "prop-1",
            updatedAt: new Date("2026-07-15T10:00:00.000Z"),
            createdAt: new Date("2026-07-10T10:00:00.000Z"),
          },
        ],
      },
    });

    render(<ProyectosTab client={buildClient()} navigateToProject={vi.fn()} setModal={vi.fn()} />);

    expect(await screen.findByText("Definiciones")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Continuar/i })).not.toBeInTheDocument();
    const primaryLink = screen.getByRole("link", { name: "Nuevo Proyecto" });
    expect(primaryLink).toHaveAttribute("href", expect.stringContaining("/proyectos/definicion/nueva"));
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/components/crm/workspace-tabs/ProyectosTab.test.tsx`
Expected: FAIL — la sección "Definiciones" no existe todavía en el componente actual.

- [ ] **Step 3: Implementación**

Reemplazar el archivo completo `src/components/crm/workspace-tabs/ProyectosTab.tsx`
(mantiene `ProjectCard` y todo lo demás igual; solo cambia `ProyectosTab`):

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CRMClient, CRMProject } from "@/types/crm";
import {
  deriveProjectStats,
  projectStatus,
  type ProjectStats,
} from "@/lib/crm/client-stats";
import { cn } from "@/lib/utils";
import { listClientDefinitionsAction } from "@/app/(admin)/proyectos/definicion/actions";
import type { DefinitionListItem } from "@/lib/db/repos/definitions";
import { pickContinuableDefinition } from "@/lib/definition/continuable";
import { DefinitionStatusBadge } from "@/components/definition/DefinitionStatusBadge";

type ModalPayload = { type: string; data?: Record<string, string> } | null;

interface Props {
  client: CRMClient;
  navigateToProject: (clientId: string, projectId: string) => void;
  setModal: (m: ModalPayload) => void;
}

function relativeTime(dateStr: string): string {
  try { return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true }); }
  catch { return "—"; }
}

function exactDate(dateStr: string): string {
  try { return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es }); }
  catch { return dateStr; }
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface CardProps {
  project: CRMProject;
  stats: ProjectStats;
  clientId: string;
  navigateToProject: (cid: string, pid: string) => void;
  setModal: (m: ModalPayload) => void;
}

function ProjectCard({ project: p, stats, clientId, navigateToProject, setModal }: CardProps) {
  const status = projectStatus(stats);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:bg-secondary/40">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
          {p.domain && <p className="truncate text-[11px] text-muted-foreground">{p.domain}</p>}
        </div>
        <span className={cn("flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", status.colorClass)}>
          {status.label}
        </span>
      </div>

      {stats.totalTasks > 0 ? (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{stats.pct}% completado</span>
            <span className="text-muted-foreground">{stats.completed}/{stats.totalTasks} tareas</span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all", stats.pct >= 100 ? "bg-green-500" : "bg-cyan-500")}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {stats.openTasks > 0 && <span>{stats.openTasks} abierta{stats.openTasks !== 1 ? "s" : ""}</span>}
            {stats.stopped > 0 && <span className="text-red-400">{stats.stopped} detenida{stats.stopped !== 1 ? "s" : ""}</span>}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-muted-foreground italic">Sin tareas</p>
      )}

      <div className="mt-auto flex items-center justify-between">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default text-[10px] text-muted-foreground">
                Últ. alta {relativeTime(stats.lastTaskAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="border-border bg-card text-foreground text-xs">
              {exactDate(stats.lastTaskAt)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigateToProject(clientId, p.id)}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            Abrir
          </button>
          <button
            onClick={() => setModal({
              type: "editProject",
              data: {
                id: p.id,
                name: p.name,
                domain: p.domain,
                budget: p.budget.toString(),
                annual: p.annual.toString(),
                budgetIva: p.budgetIva,
                annualIva: p.annualIva,
                tech: p.tech,
                accounts: p.accounts,
                guides: p.guides,
              },
            })}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Definiciones ──────────────────────────────────────────────────────────────

function DefinitionsSection({ definitions }: { definitions: DefinitionListItem[] }) {
  if (definitions.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Definiciones
      </h4>
      <div className="grid gap-2">
        {definitions.map((d) => (
          <Link
            key={d.id}
            href={`/proyectos/definicion/${d.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {relativeTime(d.updatedAt.toString())}
              </p>
            </div>
            <DefinitionStatusBadge status={d.status} currentStation={d.currentStation} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── ProyectosTab ──────────────────────────────────────────────────────────────

export function ProyectosTab({ client, navigateToProject, setModal }: Props) {
  const [definitions, setDefinitions] = useState<DefinitionListItem[]>([]);

  const loadDefinitions = useCallback(async () => {
    const r = await listClientDefinitionsAction(client.id);
    if (r.success && r.data) setDefinitions(r.data.definitions);
  }, [client.id]);

  useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

  const projectsWithStats = useMemo(
    () => client.projects.map(p => ({ project: p, stats: deriveProjectStats(p) })),
    [client.projects],
  );

  const continuable = useMemo(() => pickContinuableDefinition(definitions), [definitions]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <DefinitionsSection definitions={definitions} />

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Proyectos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{client.projects.length} proyecto{client.projects.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {continuable ? (
            <>
              <Link
                href={`/proyectos/definicion/${continuable.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Continuar {continuable.title}
              </Link>
              <Link
                href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Nuevo Proyecto
              </Link>
            </>
          ) : (
            <Link
              href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Nuevo Proyecto
            </Link>
          )}
          <button
            onClick={() => setModal({ type: "addProject", data: { clientId: client.id } })}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Proyecto nuevo con avance
          </button>
        </div>
      </div>

      {client.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">Sin proyectos</p>
          <p className="text-xs text-muted-foreground">Agrega el primer proyecto para este cliente.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectsWithStats.map(({ project, stats }) => (
            <ProjectCard
              key={project.id}
              project={project}
              stats={stats}
              clientId={client.id}
              navigateToProject={navigateToProject}
              setModal={setModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Nota: `d.updatedAt` llega como `Date` real desde el server action (no serializado a
string por el App Router al cruzar el límite server→client en un array de objetos
planos — Next.js serializa `Date` de forma nativa en la respuesta de una Server
Action, a diferencia de una ruta API con `JSON.stringify` manual). `relativeTime`
acepta `.toString()` porque su firma es `(dateStr: string)`; se llama así para no
tener que tocar esa función compartida.

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/components/crm/workspace-tabs/ProyectosTab.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/components/crm/workspace-tabs/ProyectosTab.tsx src/components/crm/workspace-tabs/ProyectosTab.test.tsx
git commit -m "feat(crm): sección Definiciones + botón Continuar en ProyectosTab"
```

---

### Task 6: `NewDefinitionForm` — autoguardado en `localStorage`

**Files:**
- Modify: `src/components/definition/NewDefinitionForm.tsx`
- Test: `src/components/definition/NewDefinitionForm.test.tsx`

**Interfaces:**
- Sin cambio de props (`{ clientCrmId, clientName }`).

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
// src/components/definition/NewDefinitionForm.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  window.localStorage.clear();
});

const { createDefinitionActionMock, pushMock } = vi.hoisted(() => ({
  createDefinitionActionMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/definicion/actions", () => ({
  createDefinitionAction: createDefinitionActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { NewDefinitionForm } from "./NewDefinitionForm";

const DRAFT_KEY = "definicion-draft-client-1";

describe("NewDefinitionForm — autoguardado en localStorage", () => {
  it("restaura título y descarga mental guardados al montar", () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title: "Idea guardada", brainDump: "Contenido previo largo de prueba" })
    );

    render(<NewDefinitionForm clientCrmId="client-1" clientName="Cliente" />);

    expect(screen.getByDisplayValue("Idea guardada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Contenido previo largo de prueba")).toBeInTheDocument();
  });

  it("persiste en localStorage tras un debounce de escritura", async () => {
    vi.useFakeTimers();
    render(<NewDefinitionForm clientCrmId="client-1" clientName="Cliente" />);

    fireEvent.change(screen.getByPlaceholderText("Ej. Rediseño del portal de clientes"), {
      target: { value: "Nueva idea" },
    });

    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    vi.advanceTimersByTime(600);

    const raw = window.localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).title).toBe("Nueva idea");
  });

  it("limpia el localStorage al guardar el borrador exitosamente", async () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: "x", brainDump: "y" }));
    createDefinitionActionMock.mockResolvedValue({ success: true, data: { id: "def-1" } });

    render(<NewDefinitionForm clientCrmId="client-1" clientName="Cliente" />);
    fireEvent.change(screen.getByPlaceholderText("Ej. Rediseño del portal de clientes"), {
      target: { value: "Título válido" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Escribe tu idea, los problemas a solucionar o todo lo que tengas en la cabeza para poder aterrizarlo…"),
      { target: { value: "Descarga mental con más de veinte caracteres" } }
    );
    fireEvent.click(screen.getByText("Guardar borrador"));

    await waitFor(() => expect(createDefinitionActionMock).toHaveBeenCalled());
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/components/definition/NewDefinitionForm.test.tsx`
Expected: FAIL — no hay lectura/escritura de `localStorage` todavía en el componente.

- [ ] **Step 3: Implementación**

En `src/components/definition/NewDefinitionForm.tsx`, agregar `useEffect` al import
de React (línea 3):

```typescript
import { useEffect, useState } from "react";
```

Después de la línea `const [busy, setBusy] = useState<"draft" | "start" | null>(null);`
(línea 21), agregar:

```typescript
  const draftKey = `definicion-draft-${clientCrmId}`;

  // Restaura un borrador sin guardar de una sesión anterior (localStorage es
  // client-only: se hace en un efecto, no en el useState inicial, para no
  // romper el render de servidor).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title?: string; brainDump?: string };
      if (parsed.title) setTitle(parsed.title);
      if (parsed.brainDump) setBrainDump(parsed.brainDump);
    } catch {
      // localStorage no disponible (modo privado) o entrada corrupta: ignorar.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguardado silencioso mientras se escribe, debounce corto.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!title.trim() && !brainDump.trim()) return;
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ title, brainDump }));
      } catch {
        // cuota excedida o modo privado: no bloquea el formulario.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, brainDump, draftKey]);
```

Y en `submit`, limpiar la entrada al confirmar éxito (justo antes de cada
`router.push`, líneas 39-44):

```typescript
  const submit = async (start: boolean) => {
    if (!valid || busy) return;
    setBusy(start ? "start" : "draft");
    const r = await createDefinitionAction({
      clientCrmId,
      title: title.trim(),
      brainDump: brainDump.trim(),
      start,
    });
    if (!r.success || !r.data) {
      toast.error(r.error ?? "No se pudo crear la definición");
      setBusy(null);
      return;
    }
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // no bloquea la navegación si falla.
    }
    if (start) {
      router.push(`/proyectos/definicion/${r.data.id}`);
    } else {
      toast.success("Borrador guardado");
      router.push("/proyectos/definicion");
    }
  };
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/components/definition/NewDefinitionForm.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/components/definition/NewDefinitionForm.tsx src/components/definition/NewDefinitionForm.test.tsx
git commit -m "feat(definicion): autoguardado en localStorage del formulario Nueva definición"
```

---

### Task 7: `DraftEditor` — autoguardado server-side con debounce

**Files:**
- Modify: `src/components/definition/DraftEditor.tsx`
- Test: `src/components/definition/DraftEditor.test.tsx`

**Interfaces:**
- Consumes: `updateDraftAction` (ya existe, sin cambio de firma).
- Sin cambio de props (`{ data: DefinitionViewModel }`).

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
// src/components/definition/DraftEditor.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DefinitionViewModel } from "./view-model";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const { updateDraftActionMock, startDefinitionActionMock, pushMock, refreshMock } = vi.hoisted(() => ({
  updateDraftActionMock: vi.fn(),
  startDefinitionActionMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/definicion/actions", () => ({
  updateDraftAction: updateDraftActionMock,
  startDefinitionAction: startDefinitionActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { DraftEditor } from "./DraftEditor";

function buildViewModel(overrides: Partial<DefinitionViewModel> = {}): DefinitionViewModel {
  return {
    id: "def-1",
    title: "Borrador inicial",
    brainDump: "Descarga mental inicial con suficiente longitud",
    clientName: "Cliente de prueba",
    clientCrmId: "client-1",
    currentStation: "boceto",
    status: "draft",
    proposalId: null,
    stations: [],
    messagesByStation: { boceto: [], funciones: [], mvp: [], flujo: [] },
    events: [],
    ...overrides,
  };
}

describe("DraftEditor — autoguardado server-side", () => {
  it("llama a updateDraftAction sin toast tras el debounce de inactividad", () => {
    vi.useFakeTimers();
    updateDraftActionMock.mockResolvedValue({ success: true });
    render(<DraftEditor data={buildViewModel()} />);

    fireEvent.change(screen.getByDisplayValue("Borrador inicial"), {
      target: { value: "Borrador editado" },
    });

    expect(updateDraftActionMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1600);

    expect(updateDraftActionMock).toHaveBeenCalledWith({
      definitionId: "def-1",
      title: "Borrador editado",
      brainDump: "Descarga mental inicial con suficiente longitud",
    });
  });

  it("no dispara el autoguardado antes de que pase el debounce completo", () => {
    vi.useFakeTimers();
    render(<DraftEditor data={buildViewModel()} />);

    fireEvent.change(screen.getByDisplayValue("Borrador inicial"), {
      target: { value: "a medio escribir" },
    });
    vi.advanceTimersByTime(1000);

    expect(updateDraftActionMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/components/definition/DraftEditor.test.tsx`
Expected: FAIL — no hay autoguardado en background todavía, solo el guardado
explícito por clic.

- [ ] **Step 3: Implementación**

En `src/components/definition/DraftEditor.tsx`, agregar `useEffect` al import de
React (línea 3):

```typescript
import { useEffect, useState } from "react";
```

Después de la constante `valid` (línea 26), agregar el efecto de autoguardado:

```typescript
  // Autoguardado silencioso: espera 1.5s de inactividad y guarda en
  // background, sin toast — el toast explícito queda solo para el clic en
  // "Guardar borrador" (saveDraft, abajo).
  useEffect(() => {
    if (!valid) return;
    const timer = setTimeout(() => {
      updateDraftAction({
        definitionId: data.id,
        title: title.trim(),
        brainDump: brainDump.trim(),
      });
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, brainDump]);
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/components/definition/DraftEditor.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/components/definition/DraftEditor.tsx src/components/definition/DraftEditor.test.tsx
git commit -m "feat(definicion): autoguardado server-side con debounce en DraftEditor"
```

---

### Task 8: Verificación final

**Files:** ninguno (solo comandos de verificación).

- [ ] **Step 1: Suite completa**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: 0 errores de tipos, 0 errores de lint nuevos, todos los tests en verde
(incluye los 2 archivos nuevos de Tarea 1, 4, 5, 6, 7 más los ya existentes).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build limpio, sin warnings nuevos.

- [ ] **Step 3: Verificación manual en dev (9002)**

Con el dev server sirviendo `/home/ubuntu/pixeltec-os` (main — ver
[[feedback_dev_server_9002]]):
1. Abrir un cliente con una definición sin terminar → confirmar que aparece la
   sección "Definiciones" y que el botón principal dice "Continuar `<título>`".
2. Click en "Continuar" → confirma que navega al detalle correcto de esa definición.
3. Abrir el link secundario "Nuevo Proyecto" en ese mismo cliente → confirma que
   arranca un formulario nuevo en blanco (no reusa datos de la definición existente).
4. En el formulario "Nuevo Proyecto", escribir texto y recargar la página **sin**
   guardar → confirma que el texto vuelve.
5. Abrir un borrador existente (`status: draft`), escribir un cambio, esperar sin
   tocar ningún botón, recargar → confirma que el cambio persistió (autoguardado
   server-side).
6. Confirmar que el toast "Borrador guardado" solo aparece al hacer clic explícito
   en el botón, no durante el autoguardado en background.

- [ ] **Step 4: Commit final (si el Step 3 no requirió cambios de código)**

Si la verificación manual no encontró nada que corregir, no hace falta commit
adicional — el trabajo ya quedó commiteado tarea por tarea. Si se detectó algo, se
corrige y se commitea con su propio mensaje descriptivo antes de cerrar.

---

## Self-Review

**1. Cobertura de la spec:**
- Sección 1 (flujo de datos) → Tareas 2 y 3.
- Sección 2 (componentes a tocar: lista + botón "Continuar" + `DefinitionStatusBadge`) → Tareas 4 y 5.
- Sección 3 (autoguardado `NewDefinitionForm`) → Tarea 6.
- Sección 4 (autoguardado `DraftEditor`) → Tarea 7.
- Sección 5 (manejo de errores: fetch silencioso, autoguardado silencioso, `localStorage` no disponible) → cubierto inline en Tareas 3, 5, 6, 7 (todos los `try/catch` silenciosos y el `if (r.success && r.data)` sin bloquear el render).
- Sección 6 (testing) → cada tarea con test propio salvo Tareas 2/3 (repo + acción), desviación documentada en Global Constraints.
- Ambigüedad resuelta en la spec ("sin terminar" = `status !== "completed"`, más reciente por `updatedAt`) → codificada literalmente en `pickContinuableDefinition` (Tarea 1).
- Placeholder pendiente de la spec (copy del link secundario) → resuelto en Tarea 5 como "Nuevo Proyecto" en texto plano, sin estilo de botón primario — decisión tomada aquí, no queda abierto.

**2. Placeholders:** ninguno — cada paso de código trae el bloque completo, sin "TODO" ni "similar a la tarea N".

**3. Consistencia de tipos:**
- `DefinitionListItem` (Tarea 2, definido ya en `definitions.ts:105-115`) se usa igual en Tareas 3 y 5.
- `pickContinuableDefinition<T extends ContinuableDefinition>` (Tarea 1) — `DefinitionListItem` cumple `{ id, status, updatedAt: Date }`, confirmado contra su definición real.
- `listClientDefinitionsAction(clientCrmId: string): Promise<PortalActionResult<{ definitions: DefinitionListItem[] }>>` (Tarea 3) — mismo shape de retorno que consume Tarea 5 (`r.data.definitions`).
- `DefinitionStatusBadge({ status, currentStation })` (Tarea 4) — mismas dos props en sus dos consumidores (Tareas 4 y 5), tipos idénticos a los campos de `DefinitionListItem`.
