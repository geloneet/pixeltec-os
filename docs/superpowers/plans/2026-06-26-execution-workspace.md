# Execution Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the session workspace from a timer+widgets into a cohesive Centro de Ejecución Inteligente that documents work, captures blockers/observations, and generates reusable project knowledge via IA.

**Architecture:** Refactor in-place (70/30 layout unchanged). Left panel: SessionGoals → ActivityWorkspace → SessionObservations → BlockTracker. Right panel: ExecutionAssistant (unified). New components replace old ones file-by-file; CRM context gains new session mutations; a new AI endpoint handles assistant prompts.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Lucide React, Anthropic SDK, date-fns, Firestore (via CRM context).

## Global Constraints

- All UI in Spanish (labels, placeholders, empty states).
- No new npm packages — use only what's already installed.
- All Tailwind classes must match the existing dark theme (`bg-[#0F0F12]`, `zinc-*`, `cyan-*` accents).
- `font-mono tabular-nums` for all timers and durations.
- Max header height: 72px.
- Timer never compresses on responsive — breadcrumb truncates instead.
- Only 1 activity in progress per session at a time.
- Observations are immutable (no edit, no delete).
- `BlockerStatus`: `"active" | "waiting" | "resolved"` — replaces `resolved: boolean`.
- Session goals: max 3 recommended (soft limit — warn, don't block).
- Spec: `docs/superpowers/specs/2026-06-26-execution-workspace-design.md`.

---

## File Map

| Action | File |
|---|---|
| Modify | `src/types/session.ts` |
| Modify | `src/components/crm/CRMContext.tsx` |
| Modify | `src/hooks/use-work-session.ts` |
| Create | `src/app/api/workspace/ai-prompt/route.ts` |
| Modify | `src/app/api/workspace/session-summary/route.ts` |
| Modify | `src/components/workspace/WorkspaceHeader.tsx` |
| Create | `src/components/workspace/SessionGoals.tsx` |
| Create | `src/components/workspace/ActivityWorkspace.tsx` |
| Create | `src/components/workspace/SessionObservations.tsx` |
| Create | `src/components/workspace/BlockTracker.tsx` |
| Create | `src/components/workspace/ExecutionAssistant.tsx` |
| Modify | `src/components/workspace/EndSessionDialog.tsx` |
| Modify | `src/components/workspace/WorkspaceLayout.tsx` |
| Modify | `src/app/(admin)/proyectos/[id]/sesion/page.tsx` |
| Delete | `src/components/workspace/SessionTimer.tsx` |
| Delete | `src/components/workspace/CurrentActivity.tsx` |
| Delete | `src/components/workspace/ActivityTimeline.tsx` |
| Delete | `src/components/workspace/QuickNotepad.tsx` |
| Delete | `src/components/workspace/BlockReporter.tsx` |
| Delete | `src/components/workspace/SmartSidebar.tsx` |
| Delete | `src/components/workspace/SessionAICoach.tsx` |

---

## Task 1: Update session types

**Files:**
- Modify: `src/types/session.ts`

**Interfaces:**
- Produces: `SessionGoal`, `ObservationType`, `BlockerStatus`, `BlockerImpact`, `BlockerSource` — used by every subsequent task.
- Produces: updated `SessionActivity` (add `estimatedMinutes?`), `SessionNote` (add `type`, `markedForSummary?`), `SessionBlocker` (replace `resolved` with `status`, add `impact`, `source`, `resolvedAt?`), `WorkSession` (add `sessionGoals?`).

- [ ] **Step 1: Replace `src/types/session.ts` entirely**

```ts
export type BlockerType =
  | "error_api"
  | "acceso_faltante"
  | "pendiente_cliente"
  | "dependencia_externa";

export const BLOCKER_LABELS: Record<BlockerType, string> = {
  error_api: "Error de API",
  acceso_faltante: "Acceso faltante",
  pendiente_cliente: "Pendiente de cliente",
  dependencia_externa: "Dependencia externa",
};

export type BlockerStatus = "active" | "waiting" | "resolved";
export type BlockerImpact = "low" | "medium" | "high";
export type BlockerSource =
  | "technical"
  | "client"
  | "infrastructure"
  | "third_party"
  | "internal";

export const BLOCKER_STATUS_LABELS: Record<BlockerStatus, string> = {
  active: "Activo",
  waiting: "Esperando",
  resolved: "Resuelto",
};

export const BLOCKER_IMPACT_LABELS: Record<BlockerImpact, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

export const BLOCKER_SOURCE_LABELS: Record<BlockerSource, string> = {
  technical: "Técnico",
  client: "Cliente",
  infrastructure: "Infraestructura",
  third_party: "Tercero",
  internal: "Interno",
};

export type ObservationType = "observacion" | "riesgo" | "bug" | "decision";

export const OBSERVATION_META: Record<
  ObservationType,
  { emoji: string; label: string; border: string }
> = {
  observacion: { emoji: "💡", label: "Observación", border: "border-zinc-600" },
  riesgo:      { emoji: "⚠️", label: "Riesgo",      border: "border-amber-500" },
  bug:         { emoji: "🐞", label: "Bug",          border: "border-red-500"   },
  decision:    { emoji: "✅", label: "Decisión",     border: "border-green-500" },
};

export interface SessionGoal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface SessionActivity {
  id: string;
  description: string;
  startedAt: string;
  completedAt?: string;
  estimatedMinutes?: number;
}

export interface SessionNote {
  id: string;
  type: ObservationType;
  content: string;
  createdAt: string;
  markedForSummary?: boolean;
}

export interface SessionBlocker {
  id: string;
  type: BlockerType;
  description: string;
  status: BlockerStatus;
  impact: BlockerImpact;
  source: BlockerSource;
  createdAt: string;
  resolvedAt?: string;
}

export interface WorkSession {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  clientName: string;
  projectName: string;
  taskName: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: "active" | "completed";
  currentActivity?: string;
  activities: SessionActivity[];
  notes: SessionNote[];
  blockers: SessionBlocker[];
  sessionGoals?: SessionGoal[];
  deployStatus?: "yes" | "no" | "na";
  commitStatus?: boolean;
  createdBy: string;
}

export interface CoachResponse {
  question: string;
  answer: string;
  timestamp: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only from files that import the old `resolved: boolean` field on `SessionBlocker` (CRMContext, use-work-session, BlockReporter). That's expected — those get fixed in Tasks 2-3.

- [ ] **Step 3: Commit**

```bash
git add src/types/session.ts
git commit -m "refactor(workspace): update session types — goals, typed observations, 3-state blockers"
```

---

## Task 2: Update CRM context mutations

**Files:**
- Modify: `src/components/crm/CRMContext.tsx`

**Interfaces:**
- Consumes: `SessionGoal`, `SessionNote` with `ObservationType`, `SessionBlocker` with `BlockerStatus`/`BlockerImpact`/`BlockerSource` from Task 1.
- Produces (new mutations exposed on context):
  - `startActivity(sessionId: string, description: string, estimatedMinutes?: number): void`
  - `addSessionGoal(sessionId: string, text: string): void`
  - `toggleSessionGoal(sessionId: string, goalId: string): void`
  - `removeSessionGoal(sessionId: string, goalId: string): void`
  - `addSessionNote(sessionId: string, type: ObservationType, content: string): void` — replaces old signature
  - `markNoteForSummary(sessionId: string, noteId: string): void`
  - `addSessionBlocker(sessionId: string, type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource): void` — updated signature
  - `updateBlockerStatus(sessionId: string, blockerId: string, status: BlockerStatus): void`
- Keeps (unchanged): `updateCurrentActivity`, `completeActivity`, `endSession`, `getProjectSessions`, `startSession`.

- [ ] **Step 1: Update imports in CRMContext.tsx**

At the top of the file, change the import from `@/types/session`:

```ts
import type { WorkSession, BlockerType, BlockerStatus, BlockerImpact, BlockerSource, ObservationType, SessionGoal } from "@/types/session";
```

- [ ] **Step 2: Update `CRMContextValue` interface**

Replace the session-related lines in `CRMContextValue` (lines 50-57 approx):

```ts
  sessions: WorkSession[];
  startSession: (clientId: string, projectId: string, taskId: string, clientName: string, projectName: string, taskName: string) => WorkSession;
  startActivity: (sessionId: string, description: string, estimatedMinutes?: number) => void;
  updateCurrentActivity: (sessionId: string, description: string) => void;
  completeActivity: (sessionId: string) => void;
  addSessionGoal: (sessionId: string, text: string) => void;
  toggleSessionGoal: (sessionId: string, goalId: string) => void;
  removeSessionGoal: (sessionId: string, goalId: string) => void;
  addSessionNote: (sessionId: string, type: ObservationType, content: string) => void;
  markNoteForSummary: (sessionId: string, noteId: string) => void;
  addSessionBlocker: (sessionId: string, type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource) => void;
  updateBlockerStatus: (sessionId: string, blockerId: string, status: BlockerStatus) => void;
  endSession: (sessionId: string, deployStatus: "yes" | "no" | "na", commitStatus: boolean) => void;
  getProjectSessions: (projectId: string) => WorkSession[];
```

- [ ] **Step 3: Update `startSession` to initialize `sessionGoals`**

In the `startSession` callback, add `sessionGoals: []` to the new session object:

```ts
const session: WorkSession = {
  id: uid(),
  clientId, projectId, taskId,
  clientName, projectName, taskName,
  startedAt: new Date().toISOString(),
  status: "active",
  activities: [],
  notes: [],
  blockers: [],
  sessionGoals: [],
  createdBy: userEmail,
};
```

- [ ] **Step 4: Add `startActivity` callback (new — replaces the "create" branch of `updateCurrentActivity`)**

Add after the existing `updateCurrentActivity`:

```ts
const startActivity = useCallback((sessionId: string, description: string, estimatedMinutes?: number) => {
  const updated = dataRef.current.sessions.map(s => {
    if (s.id !== sessionId) return s;
    const hasOpen = s.activities.some(a => !a.completedAt);
    if (hasOpen) return s;
    const activity = {
      id: uid(),
      description,
      startedAt: new Date().toISOString(),
      ...(estimatedMinutes != null ? { estimatedMinutes } : {}),
    };
    return { ...s, currentActivity: description, activities: [...s.activities, activity] };
  });
  updateSessions(updated);
}, [updateSessions]);
```

- [ ] **Step 5: Update `updateCurrentActivity` to only update (not create)**

Replace the existing `updateCurrentActivity` implementation:

```ts
const updateCurrentActivity = useCallback((sessionId: string, description: string) => {
  const updated = dataRef.current.sessions.map(s => {
    if (s.id !== sessionId) return s;
    return {
      ...s,
      currentActivity: description,
      activities: s.activities.map(a =>
        !a.completedAt ? { ...a, description } : a
      ),
    };
  });
  updateSessions(updated);
}, [updateSessions]);
```

- [ ] **Step 6: Add goal mutations**

```ts
const addSessionGoal = useCallback((sessionId: string, text: string) => {
  const goal: SessionGoal = {
    id: uid(), text, completed: false, createdAt: new Date().toISOString(),
  };
  const updated = dataRef.current.sessions.map(s =>
    s.id === sessionId ? { ...s, sessionGoals: [...(s.sessionGoals ?? []), goal] } : s
  );
  updateSessions(updated);
}, [updateSessions]);

const toggleSessionGoal = useCallback((sessionId: string, goalId: string) => {
  const now = new Date().toISOString();
  const updated = dataRef.current.sessions.map(s => {
    if (s.id !== sessionId) return s;
    return {
      ...s,
      sessionGoals: (s.sessionGoals ?? []).map(g =>
        g.id === goalId
          ? { ...g, completed: !g.completed, completedAt: !g.completed ? now : undefined }
          : g
      ),
    };
  });
  updateSessions(updated);
}, [updateSessions]);

const removeSessionGoal = useCallback((sessionId: string, goalId: string) => {
  const updated = dataRef.current.sessions.map(s =>
    s.id === sessionId
      ? { ...s, sessionGoals: (s.sessionGoals ?? []).filter(g => g.id !== goalId) }
      : s
  );
  updateSessions(updated);
}, [updateSessions]);
```

- [ ] **Step 7: Update `addSessionNote` signature and add `markNoteForSummary`**

Replace existing `addSessionNote`:

```ts
const addSessionNote = useCallback((sessionId: string, type: ObservationType, content: string) => {
  const note = {
    id: uid(), type, content, createdAt: new Date().toISOString(),
  };
  const updated = dataRef.current.sessions.map(s =>
    s.id === sessionId ? { ...s, notes: [...s.notes, note] } : s
  );
  updateSessions(updated);
}, [updateSessions]);

const markNoteForSummary = useCallback((sessionId: string, noteId: string) => {
  const updated = dataRef.current.sessions.map(s => {
    if (s.id !== sessionId) return s;
    return {
      ...s,
      notes: s.notes.map(n => n.id === noteId ? { ...n, markedForSummary: true } : n),
    };
  });
  updateSessions(updated);
}, [updateSessions]);
```

- [ ] **Step 8: Update `addSessionBlocker` and add `updateBlockerStatus`**

Replace existing `addSessionBlocker`:

```ts
const addSessionBlocker = useCallback((
  sessionId: string,
  type: BlockerType,
  description: string,
  impact: BlockerImpact,
  source: BlockerSource,
) => {
  const blocker = {
    id: uid(), type, description, status: "active" as const, impact, source,
    createdAt: new Date().toISOString(),
  };
  const updated = dataRef.current.sessions.map(s =>
    s.id === sessionId ? { ...s, blockers: [...s.blockers, blocker] } : s
  );
  updateSessions(updated);
}, [updateSessions]);

const updateBlockerStatus = useCallback((sessionId: string, blockerId: string, status: BlockerStatus) => {
  const now = new Date().toISOString();
  const updated = dataRef.current.sessions.map(s => {
    if (s.id !== sessionId) return s;
    return {
      ...s,
      blockers: s.blockers.map(b =>
        b.id === blockerId
          ? { ...b, status, ...(status === "resolved" ? { resolvedAt: now } : {}) }
          : b
      ),
    };
  });
  updateSessions(updated);
}, [updateSessions]);
```

- [ ] **Step 9: Update the Provider value object**

In the `<CRMCtx.Provider value={{...}}>` block, replace session-related fields:

```ts
sessions,
startSession, startActivity, updateCurrentActivity, completeActivity,
addSessionGoal, toggleSessionGoal, removeSessionGoal,
addSessionNote, markNoteForSummary,
addSessionBlocker, updateBlockerStatus,
endSession, getProjectSessions,
```

- [ ] **Step 10: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors in files that still reference old method signatures (`use-work-session.ts`, component files). Those get fixed in Task 3+.

- [ ] **Step 11: Commit**

```bash
git add src/components/crm/CRMContext.tsx
git commit -m "feat(workspace): add session mutations — goals, typed observations, 3-state blockers"
```

---

## Task 3: Update `use-work-session` hook

**Files:**
- Modify: `src/hooks/use-work-session.ts`

**Interfaces:**
- Consumes: all new CRM mutations from Task 2.
- Produces: `handleStartActivity`, `handleAddGoal`, `handleToggleGoal`, `handleRemoveGoal`, `handleAddNote`, `handleMarkNoteForSummary`, `handleAddBlocker` (updated), `handleUpdateBlockerStatus` — all used by components.

- [ ] **Step 1: Replace `src/hooks/use-work-session.ts` entirely**

```ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCRM } from "@/components/crm/CRMContext";
import type { BlockerType, BlockerImpact, BlockerSource, ObservationType } from "@/types/session";

export function useWorkSession(sessionId: string) {
  const crm = useCRM();
  const session = crm.sessions.find((s) => s.id === sessionId) ?? null;

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(() => {
    if (!session) return 0;
    return Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
  });

  useEffect(() => {
    if (!session) return;
    const start = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activities ─────────────────────────────────────────────────────────────
  const [activityText, setActivityText] = useState(
    () => session?.currentActivity ?? ""
  );

  useEffect(() => {
    setActivityText(session?.currentActivity ?? "");
  }, [session?.currentActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartActivity = useCallback(
    (description: string, estimatedMinutes?: number) => {
      if (!description.trim()) return;
      crm.startActivity(sessionId, description.trim(), estimatedMinutes);
      setActivityText(description.trim());
    },
    [sessionId, crm]
  );

  const handleActivityUpdate = useCallback(() => {
    if (!activityText.trim()) return;
    crm.updateCurrentActivity(sessionId, activityText.trim());
  }, [sessionId, activityText, crm]);

  const handleActivityDone = useCallback(() => {
    if (activityText.trim()) {
      crm.updateCurrentActivity(sessionId, activityText.trim());
    }
    crm.completeActivity(sessionId);
    setActivityText("");
  }, [sessionId, activityText, crm]);

  // ── Goals ──────────────────────────────────────────────────────────────────
  const handleAddGoal = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      crm.addSessionGoal(sessionId, text.trim());
    },
    [sessionId, crm]
  );

  const handleToggleGoal = useCallback(
    (goalId: string) => {
      crm.toggleSessionGoal(sessionId, goalId);
    },
    [sessionId, crm]
  );

  const handleRemoveGoal = useCallback(
    (goalId: string) => {
      crm.removeSessionGoal(sessionId, goalId);
    },
    [sessionId, crm]
  );

  // ── Notes (Observations) ───────────────────────────────────────────────────
  const handleAddNote = useCallback(
    (type: ObservationType, content: string) => {
      if (!content.trim()) return;
      crm.addSessionNote(sessionId, type, content.trim());
    },
    [sessionId, crm]
  );

  const handleMarkNoteForSummary = useCallback(
    (noteId: string) => {
      crm.markNoteForSummary(sessionId, noteId);
    },
    [sessionId, crm]
  );

  // ── Blockers ───────────────────────────────────────────────────────────────
  const handleAddBlocker = useCallback(
    (type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource) => {
      crm.addSessionBlocker(sessionId, type, description, impact, source);
    },
    [sessionId, crm]
  );

  const handleUpdateBlockerStatus = useCallback(
    (blockerId: string, status: import("@/types/session").BlockerStatus) => {
      crm.updateBlockerStatus(sessionId, blockerId, status);
    },
    [sessionId, crm]
  );

  // ── End session ────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(
    (deployStatus: "yes" | "no" | "na", commitStatus: boolean) => {
      crm.endSession(sessionId, deployStatus, commitStatus);
    },
    [sessionId, crm]
  );

  // ── Inactivity guard (20 min) ──────────────────────────────────────────────
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
  }, [session?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    session,
    elapsed,
    activityText,
    setActivityText,
    handleStartActivity,
    handleActivityUpdate,
    handleActivityDone,
    handleAddGoal,
    handleToggleGoal,
    handleRemoveGoal,
    handleAddNote,
    handleMarkNoteForSummary,
    handleAddBlocker,
    handleUpdateBlockerStatus,
    handleEndSession,
    showInactiveAlert,
    setShowInactiveAlert,
  };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -40
```

Expected: remaining errors only in component files that import the old hook shape.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-work-session.ts
git commit -m "refactor(workspace): update use-work-session hook with new session handlers"
```

---

## Task 4: AI prompt endpoint

**Files:**
- Create: `src/app/api/workspace/ai-prompt/route.ts`
- Modify: `src/app/api/workspace/session-summary/route.ts` (update to use new types)

**Interfaces:**
- Produces: `POST /api/workspace/ai-prompt` — accepts `{session, elapsed, promptKey}` where `promptKey` is `"resumen" | "commit" | "siguiente" | "riesgos" | "bitacora" | "libre"`, plus `customPrompt?: string` for libre. Returns `{text: string}`.

- [ ] **Step 1: Create `src/app/api/workspace/ai-prompt/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { WorkSession } from "@/types/session";

const client = new Anthropic();

type PromptKey = "resumen" | "commit" | "siguiente" | "riesgos" | "bitacora" | "libre";

interface RequestBody {
  session: WorkSession;
  elapsed?: number;
  promptKey: PromptKey;
  customPrompt?: string;
}

function buildContext(session: WorkSession, elapsed?: number): string {
  const durationMin = elapsed != null
    ? Math.round(elapsed / 60)
    : session.durationSeconds != null
    ? Math.round(session.durationSeconds / 60)
    : 0;

  const goals = (session.sessionGoals ?? [])
    .map(g => `${g.completed ? "✓" : "☐"} ${g.text}`)
    .join("\n") || "Sin objetivos definidos";

  const activities = session.activities
    .filter(a => a.completedAt)
    .map(a => `✓ ${a.description}`)
    .join("\n") || "Sin actividades completadas";

  const inProgress = session.activities.find(a => !a.completedAt);
  const currentActivity = inProgress ? `▶ ${inProgress.description} (en progreso)` : "Sin actividad en progreso";

  const observations = session.notes.length > 0
    ? session.notes.map(n => `[${n.type}] ${n.content}${n.markedForSummary ? " ★" : ""}`).join("\n")
    : "Sin observaciones";

  const blockers = session.blockers.length > 0
    ? session.blockers.map(b => `[${b.status}][${b.impact}] ${b.description}`).join("\n")
    : "Sin bloqueos";

  return `PROYECTO: ${session.projectName}
CLIENTE: ${session.clientName}
TAREA: ${session.taskName}
DURACIÓN: ${durationMin} minutos

OBJETIVOS:
${goals}

ACTIVIDAD ACTUAL:
${currentActivity}

ACTIVIDADES COMPLETADAS:
${activities}

OBSERVACIONES:
${observations}

BLOQUEOS:
${blockers}`;
}

const PROMPT_TEMPLATES: Record<PromptKey, (ctx: string, custom?: string) => string> = {
  resumen: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Resume esta sesión de trabajo en 4-6 puntos concisos usando bullet points. Español. Sin encabezado.`,

  commit: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Genera un mensaje de commit en inglés siguiendo Conventional Commits. Formato: tipo(alcance): descripción corta. Luego una línea en blanco y 2-3 líneas de contexto. Solo el mensaje, sin explicaciones.`,

  siguiente: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Con base en esta sesión, ¿qué debería hacer a continuación? Responde con 3-5 pasos concretos, ordenados por prioridad. Bullet points. Español.`,

  riesgos: (ctx) => `${ctx}

Eres el asistente de un desarrollador. Analiza esta sesión y detecta riesgos antes de hacer deploy. Lista solo los riesgos reales y accionables. Bullet points. Si no hay riesgos evidentes, dilo claramente. Español.`,

  bitacora: (ctx) => `${ctx}

Eres el asistente de un desarrollador freelance. Redacta una entrada para la bitácora del proyecto. Primera persona, pasado, 3-5 oraciones, tono profesional. Incluye qué se hizo, qué se encontró y qué sigue. Sin encabezado. Solo el texto. Español.`,

  libre: (ctx, custom) => `${ctx}

${custom ?? "Resume la sesión."}`,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: RequestBody = await req.json();
    const { session, elapsed, promptKey, customPrompt } = body;

    const ctx = buildContext(session, elapsed);
    const promptFn = PROMPT_TEMPLATES[promptKey] ?? PROMPT_TEMPLATES.libre;
    const prompt = promptFn(ctx, customPrompt);

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[ai-prompt]", err);
    return NextResponse.json({ text: "", error: "Error generando respuesta" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update `src/app/api/workspace/session-summary/route.ts` to use new types**

The `blockers` field no longer has `resolved` — it has `status`. Update the blockers serialization:

```ts
// Replace lines ~33-35:
const blockersText = session.blockers.length > 0
  ? session.blockers.map((b) => `- [${b.status}][${b.impact}] ${b.description}`).join("\n")
  : "Sin bloqueos";
```

Also add goals and observations to the session-summary prompt. Replace the prompt constant:

```ts
const goalsText = (session.sessionGoals ?? [])
  .map(g => `${g.completed ? "✓" : "☐"} ${g.text}`)
  .join("\n") || "Sin objetivos definidos";

const observationsText = session.notes.length > 0
  ? session.notes.map(n => `[${n.type}] ${n.content}`).join("\n")
  : "Sin observaciones";
```

Then update the prompt string to include `OBJETIVOS:\n${goalsText}\n\nOBSERVACIONES:\n${observationsText}\n\n` before BLOQUEOS.

Remove the `coachText`/`coachResponses` section entirely from the prompt (SessionAICoach is removed).

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "api/workspace" | head -10
```

Expected: no errors in these files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/workspace/ai-prompt/route.ts src/app/api/workspace/session-summary/route.ts
git commit -m "feat(workspace): add AI prompt endpoint, update session-summary for new types"
```

---

## Task 5: Mission Control Header

**Files:**
- Modify: `src/components/workspace/WorkspaceHeader.tsx`
- Delete: `src/components/workspace/SessionTimer.tsx`

**Interfaces:**
- Consumes: `WorkSession`, `CRMTask` (for `task.prio`), `elapsed: number`.
- Produces: `WorkspaceHeader` component with Mission Control layout.

- [ ] **Step 1: Replace `WorkspaceHeader.tsx`**

```tsx
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkSession } from "@/types/session";
import type { CRMTask } from "@/types/crm";

interface Props {
  session: WorkSession;
  task: CRMTask;
  elapsed: number;
  onFinalize: () => void;
}

const PRIO_LABELS: Record<CRMTask["prio"], string> = {
  urgent_important: "Urgente e importante",
  important: "Alta",
  urgent: "Urgente",
  low: "Baja",
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatStartTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
}

function SessionHealth({ session }: { session: WorkSession }) {
  const activeBlockers = session.blockers.filter(b => b.status === "active");
  const waitingBlockers = session.blockers.filter(b => b.status === "waiting");

  if (activeBlockers.length > 0) {
    return (
      <span className="text-[0.7rem] text-red-400">
        ● {activeBlockers.length} bloqueo{activeBlockers.length > 1 ? "s" : ""} activo{activeBlockers.length > 1 ? "s" : ""}
      </span>
    );
  }
  if (waitingBlockers.length > 0) {
    return (
      <span className="text-[0.7rem] text-amber-400">
        ● {waitingBlockers.length} esperando
      </span>
    );
  }
  return <span className="text-[0.7rem] text-zinc-500">● Sin bloqueos</span>;
}

export function WorkspaceHeader({ session, task, elapsed, onFinalize }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0F0F12] px-6 py-3 min-h-[60px] max-h-[72px]">
      {/* Left: nav + breadcrumb */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/proyectos/${session.projectId}?tab=tareas`)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </button>
          <div className="h-3 w-px bg-white/[0.08] flex-shrink-0" />
          <p className="text-xs text-zinc-400 truncate min-w-0">
            <span>{session.clientName}</span>
            <span className="text-zinc-700 mx-1.5">·</span>
            <span>{session.projectName}</span>
            <span className="text-zinc-700 mx-1.5">·</span>
            <span className="text-zinc-200 font-medium">{session.taskName}</span>
          </p>
        </div>
        <p className="text-[0.7rem] text-zinc-600 pl-[calc(0.75rem+0.25rem+12px)]">
          Trabajando desde las {formatStartTime(session.startedAt)}
          {task.prio !== "low" && (
            <span className="ml-2">· {PRIO_LABELS[task.prio]}</span>
          )}
        </p>
      </div>

      {/* Right: timer + status + action */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-[1.375rem] font-bold tabular-nums text-zinc-100 leading-none">
            {formatElapsed(elapsed)}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[0.7rem] font-medium text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Activa
            </span>
            <SessionHealth session={session} />
          </div>
        </div>
        <button
          onClick={onFinalize}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/30 flex-shrink-0"
        >
          Finalizar sesión
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete `SessionTimer.tsx`**

```bash
rm /home/ubuntu/pixeltec-os/src/components/workspace/SessionTimer.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "WorkspaceHeader\|SessionTimer" | head -10
```

Expected: no errors referencing these files.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/WorkspaceHeader.tsx
git rm src/components/workspace/SessionTimer.tsx
git commit -m "feat(workspace): Mission Control header with timer hero + session health indicator"
```

---

## Task 6: SessionGoals component

**Files:**
- Create: `src/components/workspace/SessionGoals.tsx`

**Interfaces:**
- Consumes: `goals: SessionGoal[]`, `onAdd`, `onToggle`, `onRemove` callbacks.
- Produces: `SessionGoals` component.

- [ ] **Step 1: Create `src/components/workspace/SessionGoals.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { SessionGoal } from "@/types/session";

interface Props {
  goals: SessionGoal[];
  onAdd: (text: string) => void;
  onToggle: (goalId: string) => void;
  onRemove: (goalId: string) => void;
}

const MAX_ACTIVE = 3;

export function SessionGoals({ goals, onAdd, onToggle, onRemove }: Props) {
  const [text, setText] = useState("");
  const activeCount = goals.filter(g => !g.completed).length;
  const atLimit = activeCount >= MAX_ACTIVE;

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">Objetivos de esta sesión</p>
        {goals.length > 0 && (
          <span className="text-[0.65rem] text-zinc-600">
            {goals.filter(g => g.completed).length}/{goals.length} completados
          </span>
        )}
      </div>

      {goals.length === 0 ? (
        <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
          Sin objetivos definidos. Agrega hasta {MAX_ACTIVE} objetivos para mantener el enfoque durante esta sesión.
        </p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {goals.map(goal => (
            <li key={goal.id} className="group flex items-start gap-2">
              <button
                onClick={() => onToggle(goal.id)}
                className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                  goal.completed
                    ? "border-green-500 bg-green-500/20"
                    : "border-zinc-600 hover:border-zinc-400"
                }`}
                aria-label={goal.completed ? "Marcar como pendiente" : "Marcar como completado"}
              >
                {goal.completed && (
                  <span className="flex h-full items-center justify-center text-[9px] text-green-400">✓</span>
                )}
              </button>
              <span className={`text-xs flex-1 leading-relaxed ${goal.completed ? "line-through text-zinc-600" : "text-zinc-300"}`}>
                {goal.text}
              </span>
              <button
                onClick={() => onRemove(goal.id)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 text-[10px] transition-opacity flex-shrink-0 mt-0.5"
                aria-label="Eliminar objetivo"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Nuevo objetivo..."
          disabled={atLimit}
          className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors disabled:opacity-40"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || atLimit}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Agregar
        </button>
      </div>
      {atLimit && (
        <p className="mt-1.5 text-[0.65rem] text-amber-500/70">
          Máximo recomendado de {MAX_ACTIVE} objetivos activos alcanzado.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "SessionGoals" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/SessionGoals.tsx
git commit -m "feat(workspace): add SessionGoals component with add/toggle/remove"
```

---

## Task 7: ActivityWorkspace component

**Files:**
- Create: `src/components/workspace/ActivityWorkspace.tsx`
- Delete: `src/components/workspace/CurrentActivity.tsx`
- Delete: `src/components/workspace/ActivityTimeline.tsx`

**Interfaces:**
- Consumes: `activities: SessionActivity[]`, `onStart(description, estimatedMinutes?)`, `onDone()`, `onUpdateText(description)`.
- Produces: `ActivityWorkspace` component — pinned in-progress + timeline + new activity form.

- [ ] **Step 1: Create `src/components/workspace/ActivityWorkspace.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionActivity } from "@/types/session";

interface Props {
  activities: SessionActivity[];
  onStart: (description: string, estimatedMinutes?: number) => void;
  onDone: () => void;
  onUpdateText: (description: string) => void;
}

const ESTIMATE_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 h",    value: 60 },
  { label: "—",      value: undefined },
];

function formatTime(iso: string): string {
  try { return format(new Date(iso), "HH:mm", { locale: es }); } catch { return "—"; }
}

function formatDuration(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } catch { return "—"; }
}

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return <span>{formatDuration(startedAt)}</span>;
}

export function ActivityWorkspace({ activities, onStart, onDone, onUpdateText }: Props) {
  const inProgress = activities.find(a => !a.completedAt) ?? null;
  const completed = [...activities.filter(a => !!a.completedAt)].reverse();

  const [showStartForm, setShowStartForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [estimate, setEstimate] = useState<number | undefined>(undefined);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editText, setEditText] = useState(inProgress?.description ?? "");
  const [completing, setCompleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditText(inProgress?.description ?? "");
  }, [inProgress?.description]);

  const handleStartRequest = () => {
    if (!newText.trim()) return;
    if (inProgress) {
      setShowConfirm(true);
    } else {
      onStart(newText.trim(), estimate);
      setNewText("");
      setEstimate(undefined);
      setShowStartForm(false);
    }
  };

  const handleConfirmReplace = () => {
    setCompleting(inProgress?.id ?? null);
    setTimeout(() => {
      onDone();
      onStart(newText.trim(), estimate);
      setNewText("");
      setEstimate(undefined);
      setShowStartForm(false);
      setShowConfirm(false);
      setCompleting(null);
    }, 200);
  };

  const handleDone = () => {
    if (inProgress) {
      setCompleting(inProgress.id);
      setTimeout(() => {
        onDone();
        setCompleting(null);
      }, 200);
    }
  };

  const totalCount = activities.length;
  const completedCount = completed.length;
  const inProgressCount = inProgress ? 1 : 0;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">Actividades</p>
        {totalCount > 0 && (
          <span className="text-[0.65rem] text-zinc-600">
            {completedCount} completada{completedCount !== 1 ? "s" : ""}
            {inProgressCount > 0 && " · 1 en progreso"}
          </span>
        )}
      </div>

      {/* In-progress (pinned) */}
      {inProgress && (
        <div
          className={`mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 transition-opacity duration-200 ${
            completing === inProgress.id ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-cyan-400 text-xs mt-0.5 flex-shrink-0">▶</span>
            <div className="flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={() => { if (editText.trim()) onUpdateText(editText.trim()); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (editText.trim()) onUpdateText(editText.trim()); inputRef.current?.blur(); }}}
                className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none"
              />
              <p className="text-[0.65rem] text-zinc-600 mt-0.5">
                En progreso · <LiveDuration startedAt={inProgress.startedAt} />
                {inProgress.estimatedMinutes && (
                  <span className="ml-1.5">· Est: {inProgress.estimatedMinutes >= 60 ? `${inProgress.estimatedMinutes / 60}h` : `${inProgress.estimatedMinutes} min`}</span>
                )}
              </p>
            </div>
            <button
              onClick={handleDone}
              className="flex-shrink-0 rounded-lg border border-green-500/20 bg-green-500/[0.06] px-2.5 py-1 text-[0.65rem] font-medium text-green-400 hover:bg-green-500/10 transition-all"
            >
              ✓ Finalizar
            </button>
          </div>
        </div>
      )}

      {/* Confirm replace dialog */}
      {showConfirm && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
          <p className="text-xs text-amber-300">¿Deseas finalizar la actividad actual e iniciar una nueva?</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmReplace}
              className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/20 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              Finalizar e iniciar
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* New activity form */}
      {showStartForm && !showConfirm && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 space-y-2">
          <input
            autoFocus
            type="text"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStartRequest(); } if (e.key === "Escape") { setShowStartForm(false); setNewText(""); }}}
            placeholder="Describe la actividad..."
            className="w-full bg-transparent border-b border-white/[0.06] pb-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/30 transition-colors"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-zinc-600">Estimación:</span>
            {ESTIMATE_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setEstimate(opt.value)}
                className={`rounded px-2 py-0.5 text-[0.65rem] transition-all ${
                  estimate === opt.value
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-zinc-600 hover:text-zinc-400 border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleStartRequest}
              disabled={!newText.trim()}
              className="flex-1 rounded-lg bg-zinc-800 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-40"
            >
              Iniciar actividad
            </button>
            <button
              onClick={() => { setShowStartForm(false); setNewText(""); setEstimate(undefined); }}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Completed timeline */}
      {completed.length > 0 && (
        <div className="mb-3">
          <p className="text-[0.65rem] font-medium text-zinc-600 mb-2 uppercase tracking-wider">Hoy</p>
          <div className="space-y-0">
            {completed.map((activity, i) => {
              const real = formatDuration(activity.startedAt, activity.completedAt);
              const est = activity.estimatedMinutes;
              return (
                <div key={activity.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-zinc-600 mt-1.5" />
                    {i < completed.length - 1 && (
                      <div className="w-px flex-1 bg-white/[0.04] mt-1" style={{ minHeight: "16px" }} />
                    )}
                  </div>
                  <div className="pb-2.5 min-w-0">
                    <p className="text-xs text-zinc-400 leading-snug">
                      <span className="text-green-500/70 mr-1.5">✓</span>
                      {activity.description}
                    </p>
                    <p className="text-[0.65rem] text-zinc-600">
                      {real}
                      {activity.completedAt && ` · completada ${formatTime(activity.completedAt)}`}
                      {est && ` · Est: ${est >= 60 ? `${est / 60}h` : `${est}m`}`}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 flex-shrink-0 rounded-full border border-zinc-700 mt-1.5" />
              </div>
              <p className="text-[0.65rem] text-zinc-700 pb-2">Sesión iniciada</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!inProgress && completed.length === 0 && !showStartForm && (
        <p className="text-xs text-zinc-600 mb-3">Ninguna actividad registrada aún.</p>
      )}

      {/* Start button */}
      {!showStartForm && (
        <button
          onClick={() => setShowStartForm(true)}
          className="w-full rounded-lg border border-dashed border-white/[0.08] py-2 text-xs text-zinc-600 hover:text-zinc-400 hover:border-white/[0.12] transition-all"
        >
          + Iniciar nueva actividad
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete old components**

```bash
rm /home/ubuntu/pixeltec-os/src/components/workspace/CurrentActivity.tsx
rm /home/ubuntu/pixeltec-os/src/components/workspace/ActivityTimeline.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "ActivityWorkspace\|CurrentActivity\|ActivityTimeline" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/ActivityWorkspace.tsx
git rm src/components/workspace/CurrentActivity.tsx src/components/workspace/ActivityTimeline.tsx
git commit -m "feat(workspace): ActivityWorkspace — unified timeline with inline edit, estimation, confirm dialog"
```

---

## Task 8: SessionObservations component

**Files:**
- Create: `src/components/workspace/SessionObservations.tsx`
- Delete: `src/components/workspace/QuickNotepad.tsx`

**Interfaces:**
- Consumes: `notes: SessionNote[]`, `onAdd(type, content)`, `onMarkForSummary(noteId)`.
- Produces: `SessionObservations` component.

- [ ] **Step 1: Create `src/components/workspace/SessionObservations.tsx`**

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionNote, ObservationType } from "@/types/session";
import { OBSERVATION_META } from "@/types/session";

interface Props {
  notes: SessionNote[];
  onAdd: (type: ObservationType, content: string) => void;
  onMarkForSummary: (noteId: string) => void;
}

const TYPES: ObservationType[] = ["observacion", "riesgo", "bug", "decision"];

export function SessionObservations({ notes, onAdd, onMarkForSummary }: Props) {
  const [selectedType, setSelectedType] = useState<ObservationType>("observacion");
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(selectedType, text.trim());
    setText("");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-400">Observaciones de la sesión</p>

      {/* Type selector */}
      <div className="flex gap-1.5 mb-2">
        {TYPES.map(t => {
          const meta = OBSERVATION_META[t];
          return (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              title={meta.label}
              className={`rounded-lg px-2 py-1 text-sm transition-all ${
                selectedType === t
                  ? "bg-zinc-800 border border-white/[0.1] scale-105"
                  : "text-zinc-600 hover:text-zinc-400 border border-transparent"
              }`}
            >
              {meta.emoji}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
          placeholder="Describe algo que descubriste, un riesgo, un bug o una decisión..."
          className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40"
        >
          ↵
        </button>
      </div>

      {/* Notes feed */}
      {notes.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-2">
          Nada anotado todavía. Las observaciones importantes aparecerán aquí.
        </p>
      ) : (
        <div className="space-y-2">
          {[...notes].reverse().map(note => {
            const meta = OBSERVATION_META[note.type];
            return (
              <div
                key={note.id}
                className={`group relative rounded-lg border border-white/[0.04] bg-zinc-900/30 pl-3 pr-3 py-2 border-l-2 ${meta.border}`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm flex-shrink-0 mt-0.5">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 leading-relaxed">{note.content}</p>
                    <p className="text-[0.65rem] text-zinc-600 mt-0.5">
                      {format(new Date(note.createdAt), "HH:mm", { locale: es })}
                      {note.markedForSummary && <span className="ml-1.5 text-cyan-600">· en resumen</span>}
                    </p>
                  </div>
                  {!note.markedForSummary && (
                    <button
                      onClick={() => onMarkForSummary(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-[0.65rem] text-zinc-600 hover:text-cyan-400 transition-all flex-shrink-0"
                      title="Añadir al resumen final"
                    >
                      ➜ Resumen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete `QuickNotepad.tsx`**

```bash
rm /home/ubuntu/pixeltec-os/src/components/workspace/QuickNotepad.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "Observation\|Notepad" | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/SessionObservations.tsx
git rm src/components/workspace/QuickNotepad.tsx
git commit -m "feat(workspace): SessionObservations — typed observations with left-border, mark-for-summary"
```

---

## Task 9: BlockTracker component

**Files:**
- Create: `src/components/workspace/BlockTracker.tsx`
- Delete: `src/components/workspace/BlockReporter.tsx`

**Interfaces:**
- Consumes: `blockers: SessionBlocker[]`, `onAdd(type, desc, impact, source)`, `onUpdateStatus(blockerId, status)`.
- Produces: `BlockTracker` component.

- [ ] **Step 1: Create `src/components/workspace/BlockTracker.tsx`**

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SessionBlocker, BlockerType, BlockerStatus, BlockerImpact, BlockerSource } from "@/types/session";
import {
  BLOCKER_LABELS, BLOCKER_STATUS_LABELS, BLOCKER_IMPACT_LABELS, BLOCKER_SOURCE_LABELS,
} from "@/types/session";

interface Props {
  blockers: SessionBlocker[];
  onAdd: (type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource) => void;
  onUpdateStatus: (blockerId: string, status: BlockerStatus) => void;
}

const BLOCKER_TYPES: BlockerType[] = ["error_api", "acceso_faltante", "pendiente_cliente", "dependencia_externa"];
const IMPACTS: BlockerImpact[] = ["low", "medium", "high"];
const SOURCES: BlockerSource[] = ["technical", "client", "infrastructure", "third_party", "internal"];

const STATUS_COLORS: Record<BlockerStatus, string> = {
  active:   "text-red-400 border-red-500/20 bg-red-500/[0.04]",
  waiting:  "text-amber-400 border-amber-500/20 bg-amber-500/[0.04]",
  resolved: "text-green-400 border-green-500/10 bg-green-500/[0.03]",
};

const STATUS_DOT: Record<BlockerStatus, string> = {
  active:   "🔴",
  waiting:  "🟡",
  resolved: "🟢",
};

function formatDuration(startIso: string, endIso?: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  } catch { return "—"; }
}

function BlockerCard({
  blocker,
  onUpdateStatus,
}: {
  blocker: SessionBlocker;
  onUpdateStatus: (id: string, status: BlockerStatus) => void;
}) {
  const colorClass = STATUS_COLORS[blocker.status];
  const isResolved = blocker.status === "resolved";

  return (
    <div className={`rounded-lg border p-3 ${colorClass} ${isResolved ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-sm flex-shrink-0">{STATUS_DOT[blocker.status]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-300">{blocker.description}</p>
          <p className="text-[0.65rem] text-zinc-600 mt-0.5">
            {BLOCKER_LABELS[blocker.type]}
            {" · "}
            {BLOCKER_IMPACT_LABELS[blocker.impact]}
            {" · "}
            {blocker.status === "resolved"
              ? `Bloqueó ${formatDuration(blocker.createdAt, blocker.resolvedAt)}`
              : `Bloqueado hace ${formatDuration(blocker.createdAt)}`
            }
          </p>
        </div>
      </div>

      {!isResolved && (
        <div className="flex gap-1.5 mt-2">
          {blocker.status === "active" && (
            <>
              <button
                onClick={() => onUpdateStatus(blocker.id, "waiting")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 transition-all"
              >
                Poner en espera
              </button>
              <button
                onClick={() => onUpdateStatus(blocker.id, "resolved")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-all"
              >
                Marcar resuelto
              </button>
            </>
          )}
          {blocker.status === "waiting" && (
            <>
              <button
                onClick={() => onUpdateStatus(blocker.id, "active")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
              >
                Volvió a bloquear
              </button>
              <button
                onClick={() => onUpdateStatus(blocker.id, "resolved")}
                className="rounded px-2 py-0.5 text-[0.65rem] border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-all"
              >
                Marcar resuelto
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function BlockTracker({ blockers, onAdd, onUpdateStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BlockerType>("error_api");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<BlockerImpact>("medium");
  const [source, setSource] = useState<BlockerSource>("technical");

  const handleSubmit = () => {
    if (!description.trim()) return;
    onAdd(type, description.trim(), impact, source);
    setDescription("");
    setOpen(false);
  };

  const active = blockers.filter(b => b.status === "active");
  const waiting = blockers.filter(b => b.status === "waiting");
  const resolved = blockers.filter(b => b.status === "resolved");

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-zinc-400">
          Bloqueos activos
          {(active.length + waiting.length) > 0 && (
            <span className="ml-2 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-red-400">
              {active.length + waiting.length}
            </span>
          )}
        </p>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[0.65rem] font-medium text-red-400 hover:bg-red-500/10 transition-all"
        >
          + Reportar
        </button>
      </div>

      {open && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 space-y-2">
          <select
            value={type}
            onChange={e => setType(e.target.value as BlockerType)}
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 focus:outline-none"
          >
            {BLOCKER_TYPES.map(t => (
              <option key={t} value={t}>{BLOCKER_LABELS[t]}</option>
            ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
            placeholder="Describe el bloqueo... (solo si impide avanzar más de 2 min)"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-red-500/30 focus:outline-none transition-colors"
          />
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-zinc-600 self-center">Impacto:</span>
            {IMPACTS.map(imp => (
              <button
                key={imp}
                onClick={() => setImpact(imp)}
                className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                  impact === imp
                    ? "border-zinc-500 text-zinc-200 bg-zinc-700"
                    : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {BLOCKER_IMPACT_LABELS[imp]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-zinc-600 self-center">Origen:</span>
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded px-2 py-0.5 text-[0.65rem] border transition-all ${
                  source === s
                    ? "border-zinc-500 text-zinc-200 bg-zinc-700"
                    : "border-transparent text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {BLOCKER_SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!description.trim()}
              className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
            >
              Reportar bloqueo
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {active.length === 0 && waiting.length === 0 && resolved.length === 0 && !open && (
        <p className="text-xs text-zinc-600 text-center py-2">Sin bloqueos activos.</p>
      )}

      {(active.length > 0 || waiting.length > 0) && (
        <div className="space-y-2 mb-2">
          {[...active, ...waiting].map(b => (
            <BlockerCard key={b.id} blocker={b} onUpdateStatus={onUpdateStatus} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-1.5 mt-2 border-t border-white/[0.04] pt-2">
          <p className="text-[0.65rem] text-zinc-700 font-medium uppercase tracking-wider">Resueltos</p>
          {resolved.map(b => (
            <BlockerCard key={b.id} blocker={b} onUpdateStatus={onUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete `BlockReporter.tsx`**

```bash
rm /home/ubuntu/pixeltec-os/src/components/workspace/BlockReporter.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "BlockTracker\|BlockReporter" | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/BlockTracker.tsx
git rm src/components/workspace/BlockReporter.tsx
git commit -m "feat(workspace): BlockTracker — 3-state blockers with impact/source/time-blocked"
```

---

## Task 10: ExecutionAssistant component

**Files:**
- Create: `src/components/workspace/ExecutionAssistant.tsx`
- Delete: `src/components/workspace/SmartSidebar.tsx`
- Delete: `src/components/workspace/SessionAICoach.tsx`

**Interfaces:**
- Consumes: `session: WorkSession`, `project: CRMProject`, `elapsed: number`, `onSaveAsObservation(content)`, `onSaveToBitacora(content)`.
- Produces: `ExecutionAssistant` component — unified right panel.

- [ ] **Step 1: Create `src/components/workspace/ExecutionAssistant.tsx`**

```tsx
"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Copy, Check } from "lucide-react";
import type { WorkSession } from "@/types/session";
import type { CRMProject } from "@/types/crm";

interface Props {
  session: WorkSession;
  project: CRMProject;
  elapsed: number;
  onSaveAsObservation: (content: string) => void;
  onSaveToBitacora: (content: string) => void;
}

type PromptKey = "resumen" | "commit" | "siguiente" | "riesgos" | "bitacora" | "libre";
type HealthStatus = "healthy" | "attention" | "risk";

const PROMPT_LABELS: Record<PromptKey, string> = {
  resumen:   "Resume sesión",
  commit:    "Commit message",
  siguiente: "¿Qué sigue?",
  riesgos:   "Riesgos deploy",
  bitacora:  "Redacta bitácora",
  libre:     "Pregunta libre",
};

function computeHealth(session: WorkSession, elapsed: number): HealthStatus {
  const activeBlockers = session.blockers.filter(b => b.status === "active");
  const riskObs = session.notes.filter(n => (n.type === "riesgo" || n.type === "bug") && n.markedForSummary);
  if (activeBlockers.length > 0 || riskObs.length > 0) return "risk";

  const waitingBlockers = session.blockers.filter(b => b.status === "waiting");
  const hasActiveActivity = session.activities.some(a => !a.completedAt);
  const completedGoals = (session.sessionGoals ?? []).filter(g => g.completed).length;
  const totalGoals = (session.sessionGoals ?? []).length;

  if (
    waitingBlockers.length > 0 ||
    (elapsed > 3600 && !hasActiveActivity) ||
    (elapsed > 2700 && totalGoals > 0 && completedGoals === 0)
  ) return "attention";

  return "healthy";
}

const HEALTH_CONFIG: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  healthy:   { label: "Saludable",         dot: "bg-green-400",  text: "text-green-400"  },
  attention: { label: "Atención requerida", dot: "bg-amber-400",  text: "text-amber-400"  },
  risk:      { label: "Riesgo de deploy",   dot: "bg-red-400",    text: "text-red-400"    },
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function getCommands(tech: string): { cmd: string; desc: string }[] {
  const t = tech.toLowerCase();
  const cmds: { cmd: string; desc: string }[] = [];
  if (t.includes("next") || t.includes("react")) {
    cmds.push(
      { cmd: "npm run dev",   desc: "Inicia entorno local" },
      { cmd: "npm run build", desc: "Genera build producción" },
      { cmd: "npm run lint",  desc: "Revisa errores" },
    );
  }
  if (t.includes("docker")) {
    cmds.push(
      { cmd: "docker compose up",     desc: "Levanta servicios" },
      { cmd: "docker compose logs -f", desc: "Ve logs en vivo" },
    );
  }
  cmds.push(
    { cmd: "git status",               desc: "Ver cambios pendientes" },
    { cmd: "git add . && git commit",  desc: "Registrar cambios" },
  );
  return cmds;
}

const DEPLOY_CHECKLIST = [
  "Build local exitoso",
  "Validación mobile",
  "Consola limpia",
  "Variables de entorno revisadas",
  "Commit realizado",
];

export function ExecutionAssistant({ session, project, elapsed, onSaveAsObservation, onSaveToBitacora }: Props) {
  const health = computeHealth(session, elapsed);
  const hConf = HEALTH_CONFIG[health];
  const commands = getCommands(project.tech ?? "");

  const [deployChecks, setDeployChecks] = useState<Set<number>>(new Set());
  const toggleCheck = (i: number) => {
    setDeployChecks(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<{ key: PromptKey; label: string; ago: number } | null>(null);
  const [freeText, setFreeText] = useState("");
  const [copied, setCopied] = useState(false);

  const runPrompt = useCallback(async (key: PromptKey, custom?: string) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/workspace/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, elapsed, promptKey: key, customPrompt: custom }),
      });
      const data = await res.json();
      setAiResult(data.text || "Sin respuesta.");
      setLastPrompt({ key, label: custom ?? PROMPT_LABELS[key], ago: Date.now() });
    } catch {
      setAiResult("Error al contactar el asistente.");
    } finally {
      setAiLoading(false);
    }
  }, [session, elapsed]);

  const handleCopy = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const completedGoals = (session.sessionGoals ?? []).filter(g => g.completed).length;
  const totalGoals = (session.sessionGoals ?? []).length;
  const inProgressActivity = session.activities.find(a => !a.completedAt);

  return (
    <div className="flex flex-col gap-0 h-full overflow-y-auto pb-6">
      {/* Session health */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] ${hConf.text}`}>
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${hConf.dot}`} />
        <span className="text-xs font-medium">{hConf.label}</span>
      </div>

      <div className="px-4 py-3 space-y-0 divide-y divide-white/[0.04]">

        {/* Contexto */}
        <CollapsibleSection title="Contexto">
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Proyecto</span>
              <span className="text-zinc-300">{session.projectName}</span>
            </div>
            {project.tech && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Stack</span>
                <span className="text-zinc-400 text-right max-w-[60%] truncate">{project.tech}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-zinc-600">Sesión</span>
              <span className="text-zinc-400">{formatElapsed(elapsed)}</span>
            </div>
            {totalGoals > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Objetivos</span>
                <span className={completedGoals === totalGoals ? "text-green-400" : "text-zinc-400"}>
                  {completedGoals}/{totalGoals} completados
                </span>
              </div>
            )}
            {inProgressActivity && (
              <div className="flex justify-between text-xs gap-2">
                <span className="text-zinc-600 flex-shrink-0">Actividad</span>
                <span className="text-zinc-400 text-right truncate">{inProgressActivity.description}</span>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Recordatorios */}
        <CollapsibleSection title="Recuerda" defaultOpen={false}>
          <ul className="space-y-1 pt-1">
            {[
              "Trabaja en localhost",
              "No modificar producción directamente",
              "Validar mobile antes de deploy",
              "Revisar consola de errores",
              "Revisar logs del servidor",
            ].map(tip => (
              <li key={tip} className="flex items-start gap-1.5 text-xs text-zinc-500">
                <span className="text-amber-500/60 flex-shrink-0">·</span>
                {tip}
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Deploy checklist */}
        <CollapsibleSection title="Deploy checklist" defaultOpen={false}>
          <div className="space-y-1.5 pt-1">
            {DEPLOY_CHECKLIST.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleCheck(i)}
                className="flex w-full items-center gap-2 text-left text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span className={`h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                  deployChecks.has(i) ? "border-green-500 bg-green-500/20" : "border-zinc-700"
                }`}>
                  {deployChecks.has(i) && <span className="flex h-full items-center justify-center text-[9px] text-green-400">✓</span>}
                </span>
                <span className={deployChecks.has(i) ? "line-through text-zinc-600" : ""}>{item}</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>

        {/* Comandos */}
        <CollapsibleSection title="Comandos" defaultOpen={false}>
          <div className="space-y-2 pt-1">
            {commands.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[0.7rem] text-cyan-400 truncate">{c.cmd}</p>
                  <p className="text-[0.65rem] text-zinc-600">{c.desc}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(c.cmd)}
                  className="text-[0.65rem] text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
                  title="Copiar"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* IA */}
        <CollapsibleSection title="Asistente IA">
          <div className="pt-2 space-y-3">
            {/* Prompt buttons */}
            <div className="flex flex-wrap gap-1.5">
              {(["resumen", "commit", "siguiente", "riesgos", "bitacora"] as PromptKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => runPrompt(key)}
                  disabled={aiLoading}
                  className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-[0.65rem] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all disabled:opacity-40"
                >
                  {PROMPT_LABELS[key]}
                </button>
              ))}
            </div>

            {/* Free input */}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runPrompt("libre", freeText); setFreeText(""); }}}
                placeholder="Pregunta libre..."
                className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/30 focus:outline-none transition-colors"
              />
              <button
                onClick={() => { runPrompt("libre", freeText); setFreeText(""); }}
                disabled={!freeText.trim() || aiLoading}
                className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-all disabled:opacity-40"
              >
                ↵
              </button>
            </div>

            {/* Loading */}
            {aiLoading && (
              <div className="flex items-center gap-2 py-2">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span className="text-xs text-zinc-600">Consultando asistente...</span>
              </div>
            )}

            {/* Result */}
            {aiResult && !aiLoading && (
              <div className="rounded-lg border border-white/[0.06] bg-zinc-900/30 p-3 space-y-2">
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{aiResult}</p>
                <div className="flex gap-1.5 flex-wrap border-t border-white/[0.04] pt-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[0.65rem] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-all"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={() => onSaveAsObservation(aiResult)}
                    className="rounded px-2 py-0.5 text-[0.65rem] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-all"
                  >
                    Guardar como observación
                  </button>
                  <button
                    onClick={() => onSaveToBitacora(aiResult)}
                    className="rounded px-2 py-0.5 text-[0.65rem] border border-cyan-500/20 text-cyan-600 hover:text-cyan-400 transition-all"
                  >
                    Guardar en bitácora
                  </button>
                </div>
              </div>
            )}

            {/* Last query */}
            {lastPrompt && !aiLoading && (
              <div className="flex items-center justify-between text-[0.65rem] text-zinc-700 border-t border-white/[0.04] pt-2">
                <span>
                  Última: &ldquo;{lastPrompt.label.substring(0, 20)}&rdquo;
                  {" · "}
                  {Math.round((Date.now() - lastPrompt.ago) / 60000)} min
                </span>
                <button
                  onClick={() => runPrompt(lastPrompt.key)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Repetir
                </button>
              </div>
            )}
          </div>
        </CollapsibleSection>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete old components**

```bash
rm /home/ubuntu/pixeltec-os/src/components/workspace/SmartSidebar.tsx
rm /home/ubuntu/pixeltec-os/src/components/workspace/SessionAICoach.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "ExecutionAssistant\|SmartSidebar\|AICoach" | head -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/ExecutionAssistant.tsx
git rm src/components/workspace/SmartSidebar.tsx src/components/workspace/SessionAICoach.tsx
git commit -m "feat(workspace): ExecutionAssistant — unified Dev Assistant with health, context, IA prompts"
```

---

## Task 11: Update EndSessionDialog

**Files:**
- Modify: `src/components/workspace/EndSessionDialog.tsx`

**Changes:**
1. Remove `CoachResponse` from props — it no longer exists.
2. Add `step: "blockers-review"` before checklist if active blockers exist.
3. Update `blockers` rendering to use `status` instead of `resolved`.

- [ ] **Step 1: Update the Props interface and step type**

Replace the top section of `EndSessionDialog.tsx`:

```tsx
// Remove CoachResponse import from @/types/session — it's no longer in Props
import type { WorkSession } from "@/types/session";
// Remove: import type { WorkSession, CoachResponse } from "@/types/session";

interface Props {
  open: boolean;
  session: WorkSession;
  elapsed: number;
  // coachResponses removed
  onConfirm: (deployStatus: "yes" | "no" | "na", commitStatus: boolean, bitacoraEntry: string) => void;
  onCancel: () => void;
}

// Update step type to include blockers-review:
const [step, setStep] = useState<"blockers-review" | "checklist" | "ai-summary" | "summary">("checklist");
```

- [ ] **Step 2: Update `useEffect` and `handleProceed` to start with blockers-review when needed**

```tsx
useEffect(() => {
  if (open) {
    const hasActiveBlockers = session.blockers.filter(b => b.status === "active").length > 0;
    setStep(hasActiveBlockers ? "blockers-review" : "checklist");
    setDeployStatus(null);
    setCommitStatus(null);
    setSummaryData(null);
    setSummaryLoading(false);
    setSummaryError(false);
  }
}, [open]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Add the `blockers-review` step UI before the checklist step**

Inside the main return, before the `{step === "checklist" && ...}` block:

```tsx
{step === "blockers-review" && (
  <div className="p-6">
    <h2 className="mb-1 text-base font-bold text-zinc-100">Bloqueos sin resolver</h2>
    <p className="mb-4 text-sm text-zinc-500">
      Tienes {session.blockers.filter(b => b.status === "active").length} bloqueo(s) activo(s). ¿Qué deseas hacer?
    </p>
    <div className="mb-4 space-y-2">
      {session.blockers.filter(b => b.status === "active").map(b => (
        <div key={b.id} className="rounded-lg border border-red-500/10 bg-red-500/[0.04] px-3 py-2">
          <p className="text-xs font-medium text-red-400">🔴 {b.description}</p>
        </div>
      ))}
    </div>
    <div className="space-y-2 mb-4">
      <p className="text-xs text-zinc-500">Puedes:</p>
      <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
        <li>Dejarlos abiertos para la siguiente sesión</li>
        <li>Resolverlos desde el panel de bloqueos antes de finalizar</li>
      </ul>
    </div>
    <div className="flex gap-2">
      <button
        onClick={() => setStep("checklist")}
        className="flex-1 rounded-lg bg-zinc-800 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-all"
      >
        Continuar de todas formas
      </button>
      <button
        onClick={onCancel}
        className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all"
      >
        Cancelar
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Update blockers rendering in summary step**

In the `step === "summary"` section, find the `openBlockers` count and update it:

```tsx
// Replace:
// const openBlockers = session.blockers.filter((b) => !b.resolved);
// With:
const openBlockers = session.blockers.filter((b) => b.status === "active" || b.status === "waiting");
```

- [ ] **Step 5: Update `WorkspaceLayout` to remove `coachResponses`**

In `WorkspaceLayout.tsx`, remove:
- `const [coachResponses, setCoachResponses] = useState<CoachResponse[]>([]);`
- `const handleCoachResponse = ...`
- The `coachResponses` prop on `EndSessionDialog`

Update the `EndSessionDialog` usage to not pass `coachResponses`.

- [ ] **Step 6: Verify TypeScript**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | grep "EndSessionDialog\|coachResponse" | head -10
```

- [ ] **Step 7: Commit**

```bash
git add src/components/workspace/EndSessionDialog.tsx src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(workspace): EndSessionDialog — blockers-review step, remove coachResponses"
```

---

## Task 12: Wire up WorkspaceLayout and clean up

**Files:**
- Modify: `src/components/workspace/WorkspaceLayout.tsx`
- Modify: `src/app/(admin)/proyectos/[id]/sesion/page.tsx`

**Interfaces:**
- Consumes: all new components from Tasks 5-11.
- Produces: fully wired workspace with no references to deleted components.

- [ ] **Step 1: Replace `WorkspaceLayout.tsx`**

```tsx
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CRMProject, CRMTask } from "@/types/crm";
import { useWorkSession } from "@/hooks/use-work-session";
import { useCRM } from "@/components/crm/CRMContext";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { SessionGoals } from "./SessionGoals";
import { ActivityWorkspace } from "./ActivityWorkspace";
import { SessionObservations } from "./SessionObservations";
import { BlockTracker } from "./BlockTracker";
import { FocusGuard } from "./FocusGuard";
import { EndSessionDialog } from "./EndSessionDialog";
import { ExecutionAssistant } from "./ExecutionAssistant";
import { useState } from "react";

interface Props {
  sessionId: string;
  project: CRMProject;
  task: CRMTask;
  onSessionEnd?: (bitacoraEntry: string) => void;
}

export function WorkspaceLayout({ sessionId, project, task, onSessionEnd }: Props) {
  const router = useRouter();
  const crm = useCRM();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const ws = useWorkSession(sessionId);

  const handleFinalizeConfirmed = (
    deployStatus: "yes" | "no" | "na",
    commitStatus: boolean,
    bitacoraEntry: string,
  ) => {
    ws.handleEndSession(deployStatus, commitStatus);
    setShowEndDialog(false);
    if (bitacoraEntry.trim()) {
      onSessionEnd?.(bitacoraEntry);
    }
    router.push(`/proyectos/${project.id}?tab=tareas`);
  };

  const handleSaveAsObservation = useCallback((content: string) => {
    ws.handleAddNote("decision", content);
  }, [ws]);

  const handleSaveToBitacora = useCallback((content: string) => {
    if (!ws.session) return;
    crm.addProjectLogEntry(
      ws.session.clientId,
      ws.session.projectId,
      {
        category: "Desarrollo",
        content,
        authorName: crm.userEmail ?? "Miguel",
        createdAt: new Date().toISOString(),
      }
    );
  }, [ws.session, crm]);

  if (!ws.session) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0F0F12]">
      <WorkspaceHeader
        session={ws.session}
        task={task}
        elapsed={ws.elapsed}
        onFinalize={() => setShowEndDialog(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — 70% */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-w-0" style={{ maxWidth: "70%" }}>
          <SessionGoals
            goals={ws.session.sessionGoals ?? []}
            onAdd={ws.handleAddGoal}
            onToggle={ws.handleToggleGoal}
            onRemove={ws.handleRemoveGoal}
          />
          <ActivityWorkspace
            activities={ws.session.activities}
            onStart={ws.handleStartActivity}
            onDone={ws.handleActivityDone}
            onUpdateText={ws.handleActivityUpdate}
          />
          <SessionObservations
            notes={ws.session.notes}
            onAdd={ws.handleAddNote}
            onMarkForSummary={ws.handleMarkNoteForSummary}
          />
          <BlockTracker
            blockers={ws.session.blockers}
            onAdd={ws.handleAddBlocker}
            onUpdateStatus={ws.handleUpdateBlockerStatus}
          />
        </div>

        {/* Right panel — 30% */}
        <div className="w-[30%] flex-shrink-0 overflow-y-auto border-l border-white/[0.04]">
          <ExecutionAssistant
            session={ws.session}
            project={project}
            elapsed={ws.elapsed}
            onSaveAsObservation={handleSaveAsObservation}
            onSaveToBitacora={handleSaveToBitacora}
          />
        </div>
      </div>

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

- [ ] **Step 2: Update `sesion/page.tsx` to pass `task` to `WorkspaceLayout`**

In `SesionPageInner`, update the `WorkspaceLayout` call:

```tsx
return <WorkspaceLayout sessionId={activeSession.id} project={project} task={task} onSessionEnd={handleSessionEnd} />;
```

The `task` variable is already available in `SesionPageInner` — it's passed as a prop. No other changes needed.

- [ ] **Step 3: Full TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1
```

Expected: 0 errors. Fix any remaining issues before committing.

- [ ] **Step 4: Build check**

```bash
cd /home/ubuntu/pixeltec-os && npm run build 2>&1 | tail -20
```

Expected: successful build with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/WorkspaceLayout.tsx src/app/(admin)/proyectos/[id]/sesion/page.tsx
git commit -m "feat(workspace): wire up WorkspaceLayout — Centro de Ejecución MVP complete"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Mission Control Header ≤72px, timer hero | Task 5 |
| `session.sessionGoals` model | Task 1 |
| SessionGoals CRUD in-session | Task 6 |
| ActivityWorkspace — Notion/Linear style, pinned in-progress | Task 7 |
| 1 activity per session guard + confirm dialog | Task 7 |
| `estimatedMinutes` on activities | Task 1, 7 |
| SessionObservations — 4 types, immutable, mark for summary | Task 8 |
| `ObservationType` + `markedForSummary` model | Task 1 |
| BlockTracker — 3-state + impact + source + time bloqueado | Task 9 |
| `BlockerStatus`, `BlockerImpact`, `BlockerSource` model | Task 1 |
| `resolvedAt` on blocker | Task 1, 2 |
| EndSessionDialog blockers-review gate | Task 11 |
| ExecutionAssistant (Dev Assistant) — unified right panel | Task 10 |
| Session health heuristic | Task 10 |
| Live context (goals/activity/elapsed) | Task 10 |
| AI prompts — 5 presets + free input | Task 10 |
| AI response card with Copy/Save actions | Task 10 |
| `/api/workspace/ai-prompt` endpoint | Task 4 |
| session-summary updated for new types | Task 4 |
| `WorkspaceLayout` wired with new props | Task 12 |
| Old files deleted | Tasks 5, 7, 8, 9, 10 |

**All spec requirements covered. No TBDs or placeholders.**
