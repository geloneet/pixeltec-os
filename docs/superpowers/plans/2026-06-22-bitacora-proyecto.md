# Bitácora del Proyecto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-textarea "Notas del proyecto" into a chronological operational log (`ProjectBitacora`) where each entry carries category, author, and timestamp — persisted inside the existing `crm_data/{uid}` Firestore blob.

**Architecture:** Additive data model change (`notesLog?: ProjectLogEntry[]` on `CRMProject`) with a one-time migration from legacy `quickNotes`. New `ProjectBitacora.tsx` component resolves `authorName` internally via `useUserProfile` and is slotted into the Resumen tab at position 3, pushing "Actividad reciente" to position 4.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Firebase/Firestore (single-doc CRM blob at `crm_data/{uid}`), Zod, reactfire

## Global Constraints

- `createdAt` is always ISO string: `new Date().toISOString()` — never a `Date` object, never a Firestore Timestamp
- `authorName` is persisted at entry creation time — never recalculated on render
- Migration entry id: `` `legacy-${project.id}` `` — stable across reloads, prevents re-render loops
- `quickNotes: string` stays on `CRMProject` — do not delete it
- `saveQuickNote` stays in `CRMContext` — do not delete it
- `MAX_LOG_ENTRIES = 500` enforced in `addProjectLogEntry`
- No new npm packages — use existing `cn()`, Tailwind, reactfire, and a local `relativeTime` utility
- All badge styling reuses the existing `bg-*/15 text-* border border-*/20` pattern

---

### Task 1: Types + Zod Schema

**Files:**
- Modify: `src/types/crm.ts`
- Modify: `src/lib/crm-schemas.ts`

**Interfaces:**
- Produces: `PROJECT_LOG_CATEGORIES`, `ProjectLogCategory`, `ProjectLogEntry`, `notesLog?` on `CRMProject` — all consumed by Tasks 2, 3, 4

- [ ] **Step 1: Add constant, type, and interface to `src/types/crm.ts`**

Read the file first to find the right insertion point (near other CRM types, before or after `CRMProject`). Add:

```ts
export const PROJECT_LOG_CATEGORIES = [
  "General",
  "Cliente",
  "Desarrollo",
  "Infraestructura",
  "Cobros",
] as const;

export type ProjectLogCategory = typeof PROJECT_LOG_CATEGORIES[number];

export interface ProjectLogEntry {
  id: string;
  category: ProjectLogCategory;
  content: string;
  authorName: string;   // persisted at creation — never recalculate
  createdAt: string;    // always ISO: new Date().toISOString()
}
```

- [ ] **Step 2: Add `notesLog` field to `CRMProject`**

In the `CRMProject` interface, after `quickNotes: string`, add:

```ts
notesLog?: ProjectLogEntry[];
```

- [ ] **Step 3: Add `notesLog` to `projectSchema` in `src/lib/crm-schemas.ts`**

Read the file to locate `projectSchema`. Add `PROJECT_LOG_CATEGORIES` to the imports:

```ts
import { PROJECT_LOG_CATEGORIES } from "@/types/crm";
```

Then add `notesLog` inside the `z.object({...})` of `projectSchema`:

```ts
notesLog: z.array(
  z.object({
    id: z.string(),
    category: z.enum(PROJECT_LOG_CATEGORIES),
    content: z.string(),
    authorName: z.string(),
    createdAt: z.string(),
  })
).optional(),
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add src/types/crm.ts src/lib/crm-schemas.ts
git commit -m "feat(bitacora): add ProjectLogEntry type + notesLog field + Zod schema"
```

---

### Task 2: CRMContext — addProjectLogEntry + migration

**Files:**
- Modify: `src/components/crm/CRMContext.tsx`

**Interfaces:**
- Consumes: `ProjectLogEntry`, `ProjectLogCategory` from `src/types/crm.ts` (Task 1)
- Produces: `crm.addProjectLogEntry(clientId, projectId, entry)` — consumed by Task 4

- [ ] **Step 1: Add `MAX_LOG_ENTRIES` constant**

Read `src/components/crm/CRMContext.tsx`. Near the top of the file (after imports, before the component function), add:

```ts
const MAX_LOG_ENTRIES = 500;
```

- [ ] **Step 2: Add one-time migration to the data loader**

Inside `getDoc(...)` callback, find the `.map((p: any) => ({...}))` that normalizes each project. Add `notesLog` alongside the other field assignments:

```ts
notesLog: (() => {
  const existing: ProjectLogEntry[] = p.notesLog || [];
  if (existing.length === 0 && p.quickNotes?.trim()) {
    return [{
      id: `legacy-${p.id}`,
      category: "General" as const,
      content: p.quickNotes.trim(),
      authorName: "Sistema",
      createdAt: typeof p.createdAt === "string"
        ? p.createdAt
        : new Date().toISOString(),
    }];
  }
  return existing;
})(),
```

- [ ] **Step 3: Initialize `notesLog` in `addProject`**

Find the line that creates a new `CRMProject` (`const p: CRMProject = { ...data, id: uid(), ...`). Add `notesLog: []` to the object:

```ts
const p: CRMProject = {
  ...data,
  id: uid(),
  keys: [],
  tasks: [],
  charges: [],
  guides: "",
  accounts: "",
  readme: "",
  prompt: "",
  quickNotes: "",
  notesLog: [],
  createdAt: new Date().toISOString(),
};
```

- [ ] **Step 4: Add `addProjectLogEntry` function**

After `saveQuickNote`, add:

```ts
const addProjectLogEntry = useCallback(
  (clientId: string, projectId: string, entry: Omit<ProjectLogEntry, "id">) => {
    const newEntry: ProjectLogEntry = { ...entry, id: uid() };
    const next = dataRef.current.clients.map(c =>
      c.id !== clientId ? c : {
        ...c,
        projects: c.projects.map(p =>
          p.id !== projectId ? p : {
            ...p,
            notesLog: [
              newEntry,
              ...(p.notesLog ?? []),
            ].slice(0, MAX_LOG_ENTRIES),
          }
        ),
      }
    );
    update(next);
  },
  [update]
);
```

- [ ] **Step 5: Expose in context interface and value**

Find the TypeScript interface that describes the CRM context shape (likely named `CRMContextType` or similar — it's defined near the top or alongside the context). Add:

```ts
addProjectLogEntry: (clientId: string, projectId: string, entry: Omit<ProjectLogEntry, "id">) => void;
```

Then find `<CRMCtx.Provider value={{ ... }}>` and add `addProjectLogEntry` to the value object.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/crm/CRMContext.tsx
git commit -m "feat(bitacora): add addProjectLogEntry + one-time quickNotes migration + MAX_LOG_ENTRIES"
```

---

### Task 3: `ProjectBitacora.tsx` — new component

**Files:**
- Create: `src/components/crm/ProjectBitacora.tsx`

**Interfaces:**
- Consumes:
  - `CRMProject`, `ProjectLogEntry`, `ProjectLogCategory`, `PROJECT_LOG_CATEGORIES` from `@/types/crm`
  - `useUserProfile` from `@/firebase/auth/use-user-profile`
  - `useUser` — check the import path used in `src/components/crm/CRMContext.tsx` and use the same one
  - `cn` from `@/lib/utils`
- Produces: `<ProjectBitacora project clientId onAddEntry />` — consumed by Task 4

- [ ] **Step 1: Check the `useUser` import path**

Read the imports at the top of `src/components/crm/CRMContext.tsx`. Find where `useUser` is imported from (e.g., `"reactfire"` or a local wrapper). Use that same import in the new component.

- [ ] **Step 2: Create `src/components/crm/ProjectBitacora.tsx`**

```tsx
"use client";

import { useState, useCallback } from "react";
// Use the same useUser import path found in CRMContext.tsx:
import { useUser } from "reactfire"; // verify this path
import { useUserProfile } from "@/firebase/auth/use-user-profile";
import { cn } from "@/lib/utils";
import {
  CRMProject,
  ProjectLogEntry,
  ProjectLogCategory,
  PROJECT_LOG_CATEGORIES,
} from "@/types/crm";

const MAX_VISIBLE = 5;
const MAX_PREVIEW = 300;

const CATEGORY_COLORS: Record<ProjectLogCategory, string> = {
  General:         "bg-zinc-500/15 text-zinc-400 border border-zinc-500/20",
  Cliente:         "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20",
  Desarrollo:      "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  Infraestructura: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  Cobros:          "bg-green-500/15 text-green-400 border border-green-500/20",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} semanas`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} meses`;
}

interface Props {
  project: CRMProject;
  clientId: string;
  onAddEntry: (entry: Omit<ProjectLogEntry, "id">) => void;
}

export function ProjectBitacora({ project, onAddEntry }: Props) {
  const user = useUser();
  const profile = useUserProfile();

  const [category, setCategory] = useState<ProjectLogCategory>("General");
  const [content, setContent] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const notesLog = project.notesLog ?? [];
  const visible = notesLog.slice(0, MAX_VISIBLE);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const authorName =
      profile?.displayName ||
      user?.displayName ||
      user?.email ||
      "Usuario";
    onAddEntry({
      category,
      content: trimmed,
      authorName,
      createdAt: new Date().toISOString(),
    });
    setContent("");
    setCategory("General");
  }, [content, category, onAddEntry, profile, user]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const headerSub =
    notesLog.length === 0
      ? null
      : notesLog.length === 1
      ? "1 registro"
      : `${notesLog.length} registros`;

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-zinc-300">Bitácora del proyecto</h3>
        {headerSub && (
          <span className="text-[11px] text-zinc-600">{headerSub}</span>
        )}
      </div>

      {/* Capture form */}
      <div className="mb-4 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 space-y-3">
        {/* Category selector */}
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_LOG_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                category === cat
                  ? CATEGORY_COLORS[cat]
                  : "bg-zinc-800/60 text-zinc-500 hover:text-zinc-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Escribe una actualización relevante del proyecto…"
          rows={3}
          className="w-full resize-none rounded-lg border border-white/[0.06] bg-[#18181B] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0EA5E9]/40 focus:outline-none transition-colors"
        />

        {/* Submit */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="px-4 py-1.5 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            Agregar nota
          </button>
        </div>
      </div>

      {/* Note list */}
      {visible.length === 0 ? (
        <p className="text-sm leading-relaxed text-zinc-600">
          No existen registros en la bitácora. Utiliza el formulario superior para
          registrar la primera actualización del proyecto.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map(entry => {
            const isExpanded = expanded.has(entry.id);
            const needsTruncation = entry.content.length > MAX_PREVIEW;
            const displayContent =
              needsTruncation && !isExpanded
                ? entry.content.slice(0, MAX_PREVIEW) + "…"
                : entry.content;

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-white/[0.06] bg-zinc-900/20 px-4 py-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      CATEGORY_COLORS[entry.category]
                    )}
                  >
                    {entry.category}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {entry.authorName} · {relativeTime(entry.createdAt)}
                </p>
                <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                  {displayContent}
                  {needsTruncation && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="ml-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {isExpanded ? "ver menos" : "ver más"}
                    </button>
                  )}
                </p>
              </div>
            );
          })}

          {notesLog.length > MAX_VISIBLE && (
            <button
              // stub — full history view not yet implemented
              onClick={() => {}}
              className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Ver historial completo →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Note on `useUser` return shape:** if `user?.displayName` gives a TypeScript error, check whether `useUser()` returns an `ObservableStatus` (in which case use `user?.data?.displayName`) or the Firebase `User` directly (use `user?.displayName`). Match whichever pattern `CRMContext.tsx` uses.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/ProjectBitacora.tsx
git commit -m "feat(bitacora): add ProjectBitacora component with category selector + log cards"
```

---

### Task 4: `ProjectView.tsx` — integration, cleanup, reorder

**Files:**
- Modify: `src/components/crm/ProjectView.tsx`

**Interfaces:**
- Consumes: `ProjectBitacora` from `./ProjectBitacora` (Task 3); `crm.addProjectLogEntry` from CRMContext (Task 2); `ProjectLogEntry` from `@/types/crm` (Task 1)

- [ ] **Step 1: Read `ProjectView.tsx`**

Read the file. Locate:
1. The `{/* Notas del proyecto */}` block (the textarea section — ~lines 400–416)
2. The `noteValue` state declaration (~line 162)
3. The `noteTimer` ref declaration (~line 163)
4. The `handleNoteChange` callback (~lines 193–199)
5. The `{/* Actividad reciente */}` block position relative to Notas
6. The Resumen tab render order to confirm current sequence

- [ ] **Step 2: Add import for `ProjectBitacora` and `ProjectLogEntry`**

At the top of `ProjectView.tsx`, add:

```ts
import { ProjectBitacora } from "./ProjectBitacora";
import type { ProjectLogEntry } from "@/types/crm";
```

- [ ] **Step 3: Add `handleAddLogEntry` with `useCallback`**

Inside the `ProjectView` component function, near the other callback definitions, add:

```ts
const handleAddLogEntry = useCallback(
  (entry: Omit<ProjectLogEntry, "id">) => {
    crm.addProjectLogEntry(client.id, project.id, entry);
  },
  [crm, client.id, project.id]
);
```

- [ ] **Step 4: Remove the old notes state, ref, and handler**

Delete these three declarations (they become unused once the textarea block is removed):
- `const [noteValue, setNoteValue] = useState(project.quickNotes);`
- `const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);`
- The `handleNoteChange` `useCallback` block

- [ ] **Step 5: Replace the `{/* Notas del proyecto */}` block with `<ProjectBitacora>`**

Find the Notas del proyecto JSX block (the `<div>` containing the `<h3>Notas del proyecto</h3>` and the `<textarea>`). Replace the entire block with:

```tsx
<ProjectBitacora
  project={project}
  clientId={client.id}
  onAddEntry={handleAddLogEntry}
/>
```

- [ ] **Step 6: Move `{/* Actividad reciente */}` after `<ProjectBitacora>`**

In the Resumen tab, ensure the final order is:
1. KPIs block (unchanged)
2. Siguiente acción block (unchanged)
3. `<ProjectBitacora ... />` ← position 3
4. Actividad reciente block ← position 4 (was 3)

If Actividad reciente was already below Notas, this step may already be correct after Step 5. If it was above, cut and paste the entire Actividad reciente block to after `<ProjectBitacora />`.

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: clean. If there are unused-variable errors for `noteValue` / `noteTimer` / `handleNoteChange`, double-check that all three were removed in Step 4.

- [ ] **Step 8: Commit**

```bash
git add src/components/crm/ProjectView.tsx
git commit -m "feat(bitacora): wire ProjectBitacora into Resumen tab, remove quickNotes textarea"
```

---

## Verification Checklist

After all tasks complete, open a project in the browser and verify:

- [ ] A project with existing `quickNotes` shows a `[General]` card with `authorName: "Sistema"` and the migrated content
- [ ] A project with empty `quickNotes` shows the empty-state message (no crash)
- [ ] Adding a note: card appears at top with correct badge color, author name, and "hace un momento"
- [ ] Reloading the page: the migrated entry always has `id: legacy-{projectId}` (no duplicate on reload)
- [ ] Content longer than 300 chars: card shows truncated text + "ver más"; clicking expands; "ver menos" collapses
- [ ] Adding 6+ notes: only 5 cards shown; "Ver historial completo →" stub appears (clicking does nothing — expected)
- [ ] Header shows "N registros" when notes exist
- [ ] Opening "Editar proyecto" modal: no notes field present
- [ ] Resumen tab order: KPIs → Siguiente acción → Bitácora → Actividad reciente
- [ ] `npx tsc --noEmit` remains clean
