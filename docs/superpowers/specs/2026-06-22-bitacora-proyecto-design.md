# Bitácora del Proyecto — Design Spec

**Date:** 2026-06-22
**Status:** Approved — ready for implementation

## Context

The current "Notas del proyecto" section is a single `quickNotes: string` textarea that
overwrites historical context. There is no way to know who wrote a note, when, or what
topic it covers. This spec converts it into a chronological operational log (bitácora)
where each entry is an independent, immutable record.

Product principle: **human context before automated events**. The log captures operational
knowledge that would otherwise be lost in WhatsApp, Telegram, or memory.

---

## 1. Data Model

### Constants and types — `src/types/crm.ts`

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
  authorName: string;   // persisted at creation — never recalculated
  createdAt: string;    // always ISO: new Date().toISOString()
}
```

### `CRMProject` — additive change

Add one optional field. `quickNotes: string` remains as a legacy field — do not remove it.

```ts
notesLog?: ProjectLogEntry[];
```

### Zod schema — `src/lib/crm-schemas.ts`

Add to `projectSchema` to protect data shape (not for form validation):

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

Import `PROJECT_LOG_CATEGORIES` from `src/types/crm.ts`.

---

## 2. One-Time Migration

Location: data loader in `CRMContext.tsx`, inside the `.map((p: any) => {...})` block
that normalizes each project on `getDoc` (~line 83).

**Rule:** if `notesLog` is empty/absent AND `quickNotes` has content → create one legacy
entry. The stable `id: \`legacy-${p.id}\`` ensures no re-renders or duplicates across
loads.

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

After migration: UI consumes only `notesLog`. `quickNotes` remains in Firestore as a
legacy field.

---

## 3. CRMContext — `addProjectLogEntry`

Add alongside existing `addTask`, `addProject`, `addRecurringCharge` pattern.

```ts
const MAX_LOG_ENTRIES = 500; // guards Firestore single-document size limit

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

**Prepend** (not append) keeps the list sorted most-recent-first without any sort/reverse
on every render.

Expose in context interface:
```ts
addProjectLogEntry: (clientId: string, projectId: string, entry: Omit<ProjectLogEntry, "id">) => void;
```

`saveQuickNote` stays — do not remove until legacy cleanup is confirmed safe.

---

## 4. Component `ProjectBitacora.tsx`

**Path:** `src/components/crm/ProjectBitacora.tsx`

### Props

```ts
interface Props {
  project: CRMProject;
  clientId: string;
  onAddEntry: (entry: Omit<ProjectLogEntry, "id">) => void;
}
```

### `authorName` resolution (inside component)

```ts
const profile = useUserProfile();
const { user } = useAuth(); // or equivalent Firebase hook

const resolveAuthorName = (): string =>
  profile?.displayName ||
  user?.displayName ||
  user?.email ||
  "Usuario";
```

Resolved once at note creation time — passed into the entry object, never recalculated.

### Constants

```ts
const MAX_VISIBLE = 5;
const MAX_PREVIEW = 300; // chars — visual truncation only, full content stored
```

### Category badge colors

```ts
const CATEGORY_COLORS: Record<ProjectLogCategory, string> = {
  General:        "bg-zinc-500/15 text-zinc-400",
  Cliente:        "bg-cyan-500/15 text-cyan-400",
  Desarrollo:     "bg-purple-500/15 text-purple-400",
  Infraestructura:"bg-amber-500/15 text-amber-400",
  Cobros:         "bg-green-500/15 text-green-400",
};
```

### Layout structure

```
Section header
├── "Bitácora del proyecto"
└── "[N] registros"  OR  "Última actualización hace X"  (if notesLog has entries)

Form
├── Category selector  (pill buttons or <select> — 5 options from PROJECT_LOG_CATEGORIES)
├── <textarea> placeholder="Escribe una actualización relevante del proyecto…"
└── <button> "Agregar nota"  [disabled if textarea empty]

Note list (notesLog.slice(0, MAX_VISIBLE))
├── Each card:
│   ├── [ Category badge ]
│   ├── authorName · formatDistanceToNow(new Date(createdAt)) + "addSuffix: true"
│   └── content (truncated at MAX_PREVIEW chars with "…ver más" toggle if longer)
│
├── Empty state (notesLog empty):
│   "No existen registros en la bitácora. Utiliza el formulario superior para
│    registrar la primera actualización del proyecto."
│
└── Footer (notesLog.length > MAX_VISIBLE):
    "Ver historial completo →"  (stub — onClick console.log or no-op for now)
```

### Date formatting

```ts
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: es })
// → "hace 4 horas"
```

---

## 5. `ProjectView.tsx` Changes

### Resumen tab — new order

| # | Before | After |
|---|--------|-------|
| 1 | KPIs | KPIs ← unchanged |
| 2 | Siguiente acción | Siguiente acción ← unchanged |
| 3 | Actividad reciente | **Bitácora del proyecto** ← moved up |
| 4 | Notas del proyecto | Actividad reciente ← moved down |

Rationale: human operational context before automated events.

### Removals

- Delete the `{/* Notas del proyecto */}` block (textarea + char counter + hint text)
- Delete `noteValue` state
- Delete `noteTimer` ref
- Delete `handleNoteChange` callback
- Delete `saveQuickNote` call site (the function itself stays in CRMContext)

### Addition

```tsx
const handleAddLogEntry = useCallback(
  (entry: Omit<ProjectLogEntry, "id">) => {
    crm.addProjectLogEntry(client.id, project.id, entry);
  },
  [crm, client.id, project.id]
);

// In JSX at position 3 of Resumen tab:
<ProjectBitacora
  project={project}
  clientId={client.id}
  onAddEntry={handleAddLogEntry}
/>
```

---

## 6. Out of Scope

- Full history view / pagination (stub link only)
- Editing or deleting log entries
- Filtering by category
- `useProjectBitacora` hook extraction
- CmdK / search indexing for log entries
- Removing `quickNotes` field from Firestore schema
- Removing `saveQuickNote` from CRMContext
- Evaluating whether Bitácora replaces Actividad reciente (backlog)

---

## 7. Verification

1. `npx tsc --noEmit` — clean
2. Open a project with existing `quickNotes` → first card shows `[General] Sistema` with the migrated content
3. Open a project with no `quickNotes` → empty state message visible
4. Add a note → appears instantly at top of list with correct badge color, author name, and relative time
5. Add a note with >300 chars → truncated in card, "…ver más" visible
6. Add 6+ notes → only 5 shown, "Ver historial completo →" stub visible
7. Edit project (Editar button) → no notes field in modal (notes only via bitácora)
8. Reload page → migration entry still has same `id: legacy-{projectId}`, no duplicates
