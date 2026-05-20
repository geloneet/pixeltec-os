# Asistente Fase 1 — Vista Semanal + CRUD Tareas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a protected `/asistente` section for weekly personal task management with full CRUD and a 7-column week grid view.

**Architecture:** Self-contained module under `src/lib/assistant/` (constants, types, schemas, helpers, queries, actions) plus server page + client layout + isolated `_components/` folder. All timezone conversions go through `week-helpers.ts` using `date-fns-tz`. Firestore queries use Admin SDK server-side; the page is a Server Component that passes serialized data to a client shell.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui + Radix UI, react-hook-form + Zod, date-fns v3.6.0, date-fns-tz (to install), Firebase Admin SDK, Lucide React, Sonner toasts.

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/assistant/constants.ts` | TIMEZONE, WEEK_STARTS_ON, CATEGORIES, STATUSES, DAYS_OF_WEEK |
| `src/lib/assistant/types.ts` | TS types + `serializeTask()` helper |
| `src/lib/assistant/schemas.ts` | Zod schemas + local `ActionResult<T>` |
| `src/lib/assistant/week-helpers.ts` | Pure timezone-aware date functions |
| `src/lib/assistant/firebase-admin.ts` | `db()` bridge + COL constant |
| `src/lib/assistant/queries/tasks.ts` | `getCurrentWeekTasks()`, `getTaskById()` |
| `src/lib/assistant/queries/stats.ts` | `computeWeekStats()` |
| `src/lib/assistant/actions/tasks.ts` | Server actions: create/update/status/postpone/delete |
| `src/app/(admin)/asistente/page.tsx` | Server Component page |
| `src/app/(admin)/asistente/asistente-client.tsx` | Client shell with state |
| `src/app/(admin)/asistente/_components/week-grid.tsx` | 7-col grid |
| `src/app/(admin)/asistente/_components/task-card.tsx` | Single task card + dropdown |
| `src/app/(admin)/asistente/_components/stats-cards.tsx` | 5-col stats grid |
| `src/app/(admin)/asistente/_components/today-card.tsx` | Today's tasks list |
| `src/app/(admin)/asistente/_components/category-distribution.tsx` | Horizontal bar chart |
| `src/app/(admin)/asistente/_components/report-status-card.tsx` | Phase 4 placeholder |
| `src/app/(admin)/asistente/_components/task-form-dialog.tsx` | Create/edit dialog |
| `src/app/(admin)/asistente/_components/postpone-dialog.tsx` | Postpone date/time picker |
| `firestore.indexes.json` | Add `assistantTasks` composite index |
| `package.json` / `package-lock.json` | Add `date-fns-tz` |

---

## Task 1: Install date-fns-tz

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /home/ubuntu/pixeltec-os
npm install date-fns-tz
```

Expected output: `added 1 package` (or similar — `date-fns-tz` is a peer to `date-fns`, no sub-deps).

- [ ] **Step 2: Verify it's in package.json**

```bash
grep '"date-fns-tz"' package.json
```

Expected: `"date-fns-tz": "^3.x.x"` (version ≥ 3.0.0 required for date-fns v3 compat).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add date-fns-tz for MX timezone helpers"
```

---

## Task 2: Add Firestore index

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add the assistantTasks composite index**

Open `firestore.indexes.json` and insert the new index into the `"indexes"` array:

```json
{
  "indexes": [
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "alertRules",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "deletedAt", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "blogPosts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "seo.noindex", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "publishedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "assistantTasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "weekKey", "order": "ASCENDING" },
        { "fieldPath": "startsAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json; json.load(open('firestore.indexes.json')); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "firestore: add assistantTasks composite index"
```

---

## Task 3: Constants + Types

**Files:**
- Create: `src/lib/assistant/constants.ts`
- Create: `src/lib/assistant/types.ts`

- [ ] **Step 1: Create constants.ts**

```typescript
// src/lib/assistant/constants.ts
import type { LucideIcon } from 'lucide-react';
import { Circle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const TIMEZONE = 'America/Mexico_City';
export const WEEK_STARTS_ON = 1 as const; // Monday

export const CATEGORIES = [
  { value: 'trabajo',     label: 'Trabajo',     color: '#3b82f6' },
  { value: 'cliente',     label: 'Cliente',     color: '#06b6d4' },
  { value: 'personal',    label: 'Personal',    color: '#71717a' },
  { value: 'salud',       label: 'Salud',       color: '#22c55e' },
  { value: 'aprendizaje', label: 'Aprendizaje', color: '#a855f7' },
] as const;

export const STATUSES: Array<{
  value: string;
  label: string;
  color: string;
  icon: LucideIcon;
}> = [
  { value: 'pending',     label: 'Pendiente',   color: '#71717a', icon: Circle      },
  { value: 'in_progress', label: 'En progreso', color: '#f59e0b', icon: Loader2     },
  { value: 'completed',   label: 'Completada',  color: '#22c55e', icon: CheckCircle2},
  { value: 'cancelled',   label: 'Cancelada',   color: '#ef4444', icon: XCircle     },
  { value: 'postponed',   label: 'Pospuesta',   color: '#a855f7', icon: Clock       },
];

export const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
```

- [ ] **Step 2: Create types.ts**

```typescript
// src/lib/assistant/types.ts
import type { Timestamp } from 'firebase-admin/firestore';
import { CATEGORIES, STATUSES } from './constants';

export type AssistantTaskCategory = typeof CATEGORIES[number]['value'];
export type AssistantTaskStatus   = typeof STATUSES[number]['value'];

export interface AssistantTaskDoc {
  uid:         string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  startsAt:    Timestamp;
  durationMin: number;
  status:      AssistantTaskStatus;
  weekKey:     string;
  createdAt:   Timestamp;
  updatedAt:   Timestamp;
}

export interface AssistantTaskSerialized {
  id:          string;
  uid:         string;
  title:       string;
  description: string | null;
  category:    AssistantTaskCategory;
  startsAt:    string; // ISO UTC
  durationMin: number;
  status:      AssistantTaskStatus;
  weekKey:     string;
  createdAt:   string;
  updatedAt:   string;
}

export function serializeTask(
  doc: AssistantTaskDoc,
  id: string,
): AssistantTaskSerialized {
  return {
    id,
    uid:         doc.uid,
    title:       doc.title,
    description: doc.description,
    category:    doc.category,
    startsAt:    doc.startsAt.toDate().toISOString(),
    durationMin: doc.durationMin,
    status:      doc.status,
    weekKey:     doc.weekKey,
    createdAt:   doc.createdAt.toDate().toISOString(),
    updatedAt:   doc.updatedAt.toDate().toISOString(),
  };
}
```

- [ ] **Step 3: Type-check**

```bash
cd /home/ubuntu/pixeltec-os
npx tsc --noEmit 2>&1 | grep -E "assistant" || echo "✅ OK"
```

Expected: `✅ OK`

- [ ] **Step 4: Commit**

```bash
git add src/lib/assistant/constants.ts src/lib/assistant/types.ts
git commit -m "feat(asistente): constants + types"
```

---

## Task 4: Schemas

**Files:**
- Create: `src/lib/assistant/schemas.ts`

- [ ] **Step 1: Create schemas.ts**

```typescript
// src/lib/assistant/schemas.ts
import { z } from 'zod';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const AssistantTaskCreateSchema = z.object({
  title:       z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500).nullable().optional(),
  category:    z.enum(['trabajo', 'cliente', 'personal', 'salud', 'aprendizaje']),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  time:        z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  durationMin: z.number().int().min(15).max(480).default(60),
});
export type AssistantTaskCreateInput = z.infer<typeof AssistantTaskCreateSchema>;

export const AssistantTaskUpdateSchema = AssistantTaskCreateSchema.partial();
export type AssistantTaskUpdateInput = z.infer<typeof AssistantTaskUpdateSchema>;

export const AssistantTaskStatusSchema = z.enum([
  'pending', 'in_progress', 'completed', 'cancelled', 'postponed',
]);
export type AssistantTaskStatusInput = z.infer<typeof AssistantTaskStatusSchema>;

export const AssistantPostponeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
});
export type AssistantPostponeInput = z.infer<typeof AssistantPostponeSchema>;
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant" || echo "✅ OK"
```

Expected: `✅ OK`

- [ ] **Step 3: Commit**

```bash
git add src/lib/assistant/schemas.ts
git commit -m "feat(asistente): Zod schemas + ActionResult"
```

---

## Task 5: Firebase Admin bridge

**Files:**
- Create: `src/lib/assistant/firebase-admin.ts`

- [ ] **Step 1: Create firebase-admin.ts**

```typescript
// src/lib/assistant/firebase-admin.ts
import { getAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export function db(): Firestore {
  return getFirestore(getAdminApp());
}

export const COL = {
  assistantTasks: 'assistantTasks',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/assistant/firebase-admin.ts
git commit -m "feat(asistente): firebase-admin bridge"
```

---

## Task 6: Week helpers

**Files:**
- Create: `src/lib/assistant/week-helpers.ts`

- [ ] **Step 1: Create week-helpers.ts**

```typescript
// src/lib/assistant/week-helpers.ts
import {
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
  endOfISOWeek,
  addDays,
  isToday,
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE, DAYS_OF_WEEK } from './constants';

export function getCurrentWeekKey(): string {
  return getWeekKeyFromDate(new Date());
}

export function getWeekKeyFromDate(date: Date): string {
  // Convert to MX time before computing ISO week (avoids midnight UTC edge cases)
  const mx = toZonedTime(date, TIMEZONE);
  const week = getISOWeek(mx);
  const year = getISOWeekYear(mx);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getWeekRange(weekKey: string): { start: Date; end: Date } {
  // Parse weekKey back to a date in the middle of that week (Thursday is safe for ISO week)
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // Jan 4 is always in week 1. Find the Monday of the target week.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Mx = toZonedTime(jan4, TIMEZONE);
  const week1Monday = startOfISOWeek(jan4Mx);
  const targetMonday = addDays(week1Monday, (week - 1) * 7);
  const targetSunday = endOfISOWeek(targetMonday);

  // Convert MX midnight to UTC
  const start = fromZonedTime(
    new Date(targetMonday.getFullYear(), targetMonday.getMonth(), targetMonday.getDate(), 0, 0, 0),
    TIMEZONE,
  );
  const end = fromZonedTime(
    new Date(targetSunday.getFullYear(), targetSunday.getMonth(), targetSunday.getDate(), 23, 59, 59),
    TIMEZONE,
  );

  return { start, end };
}

export function getWeekDays(weekKey: string): Array<{
  date: Date;
  dayLabel: string;
  dayNumber: number;
  isToday: boolean;
}> {
  const { start } = getWeekRange(weekKey);
  return DAYS_OF_WEEK.map((dayLabel, i) => {
    const date = addDays(start, i);
    return {
      date,
      dayLabel,
      dayNumber: toZonedTime(date, TIMEZONE).getDate(),
      isToday: isToday(toZonedTime(date, TIMEZONE)),
    };
  });
}

// Interprets date 'YYYY-MM-DD' + time 'HH:mm' as America/Mexico_City, returns UTC Date.
export function parseDateTimeToUTC(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return fromZonedTime(
    new Date(year, month - 1, day, hours, minutes, 0),
    TIMEZONE,
  );
}

export function formatTimeMX(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'HH:mm');
}

export function formatDateMX(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

export function isCurrentWeek(weekKey: string): boolean {
  return weekKey === getCurrentWeekKey();
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant" || echo "✅ OK"
```

Expected: `✅ OK`

- [ ] **Step 3: Commit**

```bash
git add src/lib/assistant/week-helpers.ts
git commit -m "feat(asistente): timezone-aware week helpers"
```

---

## Task 7: Queries

**Files:**
- Create: `src/lib/assistant/queries/tasks.ts`
- Create: `src/lib/assistant/queries/stats.ts`

- [ ] **Step 1: Create queries/tasks.ts**

```typescript
// src/lib/assistant/queries/tasks.ts
import { db, COL } from '../firebase-admin';
import { serializeTask, type AssistantTaskDoc, type AssistantTaskSerialized } from '../types';
import { getCurrentWeekKey } from '../week-helpers';

export async function getCurrentWeekTasks(uid: string): Promise<AssistantTaskSerialized[]> {
  const weekKey = getCurrentWeekKey();
  const snap = await db()
    .collection(COL.assistantTasks)
    .where('uid', '==', uid)
    .where('weekKey', '==', weekKey)
    .orderBy('startsAt', 'asc')
    .get();

  return snap.docs.map((doc) =>
    serializeTask(doc.data() as AssistantTaskDoc, doc.id),
  );
}

export async function getTaskById(
  uid: string,
  taskId: string,
): Promise<AssistantTaskSerialized | null> {
  const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!doc.exists) return null;
  const data = doc.data() as AssistantTaskDoc;
  if (data.uid !== uid) return null;
  return serializeTask(data, doc.id);
}
```

- [ ] **Step 2: Create queries/stats.ts**

```typescript
// src/lib/assistant/queries/stats.ts
import { formatDateMX } from '../week-helpers';
import { TIMEZONE } from '../constants';
import type { AssistantTaskSerialized, AssistantTaskStatus, AssistantTaskCategory } from '../types';
import { toZonedTime } from 'date-fns-tz';

export interface WeekStats {
  total:        number;
  byStatus:     Record<AssistantTaskStatus, number>;
  byCategory:   Record<AssistantTaskCategory, number>;
  todayTasks:   AssistantTaskSerialized[];
}

export function computeWeekStats(tasks: AssistantTaskSerialized[]): WeekStats {
  const todayMX = formatDateMX(toZonedTime(new Date(), TIMEZONE));

  const byStatus = {
    pending: 0, in_progress: 0, completed: 0, cancelled: 0, postponed: 0,
  } as Record<AssistantTaskStatus, number>;

  const byCategory = {
    trabajo: 0, cliente: 0, personal: 0, salud: 0, aprendizaje: 0,
  } as Record<AssistantTaskCategory, number>;

  const todayTasks: AssistantTaskSerialized[] = [];

  for (const task of tasks) {
    byStatus[task.status]++;
    byCategory[task.category]++;
    const taskDateMX = formatDateMX(new Date(task.startsAt));
    if (taskDateMX === todayMX) todayTasks.push(task);
  }

  return { total: tasks.length, byStatus, byCategory, todayTasks };
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant" || echo "✅ OK"
```

Expected: `✅ OK`

- [ ] **Step 4: Commit**

```bash
git add src/lib/assistant/queries/
git commit -m "feat(asistente): Firestore queries + computeWeekStats"
```

---

## Task 8: Server Actions

**Files:**
- Create: `src/lib/assistant/actions/tasks.ts`

- [ ] **Step 1: Create actions/tasks.ts**

```typescript
// src/lib/assistant/actions/tasks.ts
'use server';

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { db, COL } from '../firebase-admin';
import {
  AssistantTaskCreateSchema,
  AssistantTaskUpdateSchema,
  AssistantTaskStatusSchema,
  AssistantPostponeSchema,
  type ActionResult,
} from '../schemas';
import { parseDateTimeToUTC, getWeekKeyFromDate } from '../week-helpers';
import type { AssistantTaskDoc, AssistantTaskStatus } from '../types';

// Valid status transitions (from -> to sets)
const VALID_TRANSITIONS: Partial<Record<AssistantTaskStatus, AssistantTaskStatus[]>> = {
  pending:     ['in_progress', 'completed', 'cancelled', 'postponed'],
  in_progress: ['completed', 'cancelled', 'postponed'],
  postponed:   ['pending', 'in_progress', 'cancelled'],
  completed:   ['pending'],
  cancelled:   ['pending'],
};

async function verifyOwnership(uid: string, taskId: string): Promise<boolean> {
  const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!doc.exists) return false;
  return (doc.data() as AssistantTaskDoc).uid === uid;
}

export async function createTask(
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const { title, description, category, date, time, durationMin } = parsed.data;
  const startsAt = parseDateTimeToUTC(date, time);
  const weekKey  = getWeekKeyFromDate(startsAt);
  const now      = FieldValue.serverTimestamp();

  const ref = await db().collection(COL.assistantTasks).add({
    uid,
    title,
    description:  description ?? null,
    category,
    startsAt,
    durationMin,
    status:    'pending',
    weekKey,
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<AssistantTaskDoc, 'startsAt' | 'createdAt' | 'updatedAt'> & {
    startsAt: Date;
    createdAt: unknown;
    updatedAt: unknown;
  });

  revalidatePath('/asistente');
  return { ok: true, data: { taskId: ref.id } };
}

export async function updateTask(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  const { title, description, category, date, time, durationMin } = parsed.data;

  if (title       !== undefined) updates.title       = title;
  if (description !== undefined) updates.description = description;
  if (category    !== undefined) updates.category    = category;
  if (durationMin !== undefined) updates.durationMin = durationMin;

  if (date && time) {
    const startsAt = parseDateTimeToUTC(date, time);
    updates.startsAt = startsAt;
    updates.weekKey  = getWeekKeyFromDate(startsAt);
  } else if (date || time) {
    // Partial date/time update: fetch existing to merge
    const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
    const existing = doc.data() as AssistantTaskDoc;
    const existingMXDate = existing.startsAt.toDate();
    const { formatDateMX, formatTimeMX } = await import('../week-helpers');
    const resolvedDate = date ?? formatDateMX(existingMXDate);
    const resolvedTime = time ?? formatTimeMX(existingMXDate);
    const startsAt = parseDateTimeToUTC(resolvedDate, resolvedTime);
    updates.startsAt = startsAt;
    updates.weekKey  = getWeekKeyFromDate(startsAt);
  }

  await db().collection(COL.assistantTasks).doc(taskId).update(updates);
  revalidatePath('/asistente');
  return { ok: true };
}

export async function setTaskStatus(
  taskId: string,
  status: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantTaskStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: 'Estado inválido' };

  const doc = await db().collection(COL.assistantTasks).doc(taskId).get();
  if (!doc.exists) return { ok: false, error: 'Tarea no encontrada' };

  const data = doc.data() as AssistantTaskDoc;
  if (data.uid !== uid) return { ok: false, error: 'Tarea no encontrada' };

  const allowed = VALID_TRANSITIONS[data.status] ?? [];
  if (!allowed.includes(parsed.data)) {
    return { ok: false, error: `No se puede pasar de ${data.status} a ${parsed.data}` };
  }

  await db().collection(COL.assistantTasks).doc(taskId).update({
    status:    parsed.data,
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/asistente');
  return { ok: true };
}

export async function postponeTask(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const parsed = AssistantPostponeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  const startsAt = parseDateTimeToUTC(parsed.data.date, parsed.data.time);
  const weekKey  = getWeekKeyFromDate(startsAt);

  await db().collection(COL.assistantTasks).doc(taskId).update({
    startsAt,
    weekKey,
    status:    'pending',
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/asistente');
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const owns = await verifyOwnership(uid, taskId);
  if (!owns) return { ok: false, error: 'Tarea no encontrada' };

  await db().collection(COL.assistantTasks).doc(taskId).delete();
  revalidatePath('/asistente');
  return { ok: true };
}
```

> **Note on `satisfies` cast:** The Firestore `.add()` call accepts `Date` for timestamp fields when using Admin SDK — the server converts it to `Timestamp` automatically. The `satisfies` type is for IDE help only and doesn't affect runtime.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant" || echo "✅ OK"
```

Expected: `✅ OK`

- [ ] **Step 3: Commit**

```bash
git add src/lib/assistant/actions/
git commit -m "feat(asistente): server actions CRUD"
```

---

## Task 9: Page + Client Shell

**Files:**
- Create: `src/app/(admin)/asistente/page.tsx`
- Create: `src/app/(admin)/asistente/asistente-client.tsx`

- [ ] **Step 1: Create page.tsx**

```typescript
// src/app/(admin)/asistente/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { getCurrentWeekTasks } from '@/lib/assistant/queries/tasks';
import { getCurrentWeekKey } from '@/lib/assistant/week-helpers';
import { AsistenteClient } from './asistente-client';

export default async function AsistentePage() {
  const uid = await getSessionUid();
  if (!uid) redirect('/login?redirect=/asistente');

  const [tasks, weekKey] = await Promise.all([
    getCurrentWeekTasks(uid),
    Promise.resolve(getCurrentWeekKey()),
  ]);

  return <AsistenteClient initialTasks={tasks} weekKey={weekKey} />;
}
```

- [ ] **Step 2: Create asistente-client.tsx**

```typescript
// src/app/(admin)/asistente/asistente-client.tsx
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getWeekDays } from '@/lib/assistant/week-helpers';
import { computeWeekStats } from '@/lib/assistant/queries/stats';
import { CATEGORIES } from '@/lib/assistant/constants';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';
import { WeekGrid } from './_components/week-grid';
import { StatsCards } from './_components/stats-cards';
import { TodayCard } from './_components/today-card';
import { CategoryDistribution } from './_components/category-distribution';
import { ReportStatusCard } from './_components/report-status-card';
import { TaskFormDialog } from './_components/task-form-dialog';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from '@/lib/assistant/constants';

interface Props {
  initialTasks: AssistantTaskSerialized[];
  weekKey: string;
}

function formatWeekHeader(weekKey: string, days: ReturnType<typeof getWeekDays>): string {
  const [yearStr, weekNum] = weekKey.split('-W');
  const monday = days[0].date;
  const sunday = days[6].date;
  const from = formatInTimeZone(monday, TIMEZONE, 'd MMM');
  const to   = formatInTimeZone(sunday, TIMEZONE, 'd MMM');
  return `Semana ${weekNum} · ${from} - ${to}`;
}

export function AsistenteClient({ initialTasks, weekKey }: Props) {
  const [tasks, setTasks]           = useState<AssistantTaskSerialized[]>(initialTasks);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AssistantTaskSerialized | undefined>();

  const days  = useMemo(() => getWeekDays(weekKey), [weekKey]);
  const stats = useMemo(() => computeWeekStats(tasks), [tasks]);
  const weekHeader = useMemo(() => formatWeekHeader(weekKey, days), [weekKey, days]);

  function handleNewTask() {
    setEditingTask(undefined);
    setIsFormOpen(true);
  }

  function handleTaskClick(task: AssistantTaskSerialized) {
    setEditingTask(task);
    setIsFormOpen(true);
  }

  function handleSave(task: AssistantTaskSerialized) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx === -1) return [...prev, task];
      const next = [...prev];
      next[idx] = task;
      return next;
    });
  }

  function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleStatusChange(taskId: string, status: AssistantTaskSerialized['status']) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Asistente</h1>
          <p className="text-sm text-zinc-400">{weekHeader}</p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                    Templates
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Próximamente</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" onClick={handleNewTask}>
            + Nueva actividad
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <WeekGrid
        tasks={tasks}
        weekKey={weekKey}
        onTaskClick={handleTaskClick}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      {/* Category legend */}
      <div className="flex flex-wrap gap-3">
        {CATEGORIES.map((cat) => (
          <div key={cat.value} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
            <span className="text-xs text-zinc-400">{cat.label}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
          Estadísticas de la semana
        </h2>
        <StatsCards stats={stats} />
      </div>

      {/* Bottom grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
        <TodayCard tasks={stats.todayTasks} />
        <CategoryDistribution byCategory={stats.byCategory} total={stats.total} />
        <ReportStatusCard />
      </div>

      {/* Dialogs */}
      <TaskFormDialog
        open={isFormOpen}
        task={editingTask}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant|asistente" || echo "✅ OK"
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(admin)/asistente/page.tsx' 'src/app/(admin)/asistente/asistente-client.tsx'
git commit -m "feat(asistente): server page + client shell"
```

---

## Task 10: TaskCard + PostponeDialog

**Files:**
- Create: `src/app/(admin)/asistente/_components/task-card.tsx`
- Create: `src/app/(admin)/asistente/_components/postpone-dialog.tsx`

- [ ] **Step 1: Create task-card.tsx**

```typescript
// src/app/(admin)/asistente/_components/task-card.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2 } from 'lucide-react';
import { CATEGORIES, STATUSES } from '@/lib/assistant/constants';
import { formatTimeMX } from '@/lib/assistant/week-helpers';
import { setTaskStatus, deleteTask } from '@/lib/assistant/actions/tasks';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';
import { PostponeDialog } from './postpone-dialog';

interface Props {
  task: AssistantTaskSerialized;
  onStatusChange: (taskId: string, status: AssistantTaskSerialized['status']) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: AssistantTaskSerialized) => void;
}

export function TaskCard({ task, onStatusChange, onDelete, onEdit }: Props) {
  const [postponeOpen, setPostponeOpen] = useState(false);

  const category = CATEGORIES.find((c) => c.value === task.category);
  const status   = STATUSES.find((s) => s.value === task.status);

  const isCompleted  = task.status === 'completed';
  const isCancelled  = task.status === 'cancelled';
  const isInProgress = task.status === 'in_progress';

  async function handleSetStatus(newStatus: AssistantTaskSerialized['status']) {
    const result = await setTaskStatus(task.id, newStatus);
    if (result.ok) {
      onStatusChange(task.id, newStatus);
    } else {
      toast.error(result.error ?? 'Error al actualizar estado');
    }
  }

  async function handleDelete() {
    const result = await deleteTask(task.id);
    if (result.ok) {
      onDelete(task.id);
      toast.success('Tarea eliminada');
    } else {
      toast.error(result.error ?? 'Error al eliminar');
    }
  }

  const timeMX = formatTimeMX(new Date(task.startsAt));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            className="rounded-md p-2 cursor-pointer select-none bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            style={{ borderLeft: `2px solid ${category?.color ?? '#71717a'}` }}
          >
            {/* Time */}
            <p className="text-[10px] text-zinc-500 leading-none mb-1">{timeMX}</p>

            {/* Title */}
            <p
              className="text-[12px] font-medium leading-tight"
              style={{
                color:          isCompleted || isCancelled ? '#71717a' : '#e4e4e7',
                textDecoration: isCompleted || isCancelled ? 'line-through' : 'none',
                opacity:        isCancelled ? 0.5 : isCompleted ? 0.6 : 1,
              }}
            >
              {task.title}
            </p>

            {/* In-progress badge */}
            {isInProgress && (
              <div className="flex items-center gap-1 mt-1">
                <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                <span className="text-[10px] text-amber-400">En progreso</span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="bg-zinc-900 border-zinc-700 text-zinc-100"
          align="start"
          side="right"
        >
          <DropdownMenuItem onClick={() => handleSetStatus('in_progress')}>
            Marcar en progreso
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSetStatus('completed')}>
            Marcar completada
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSetStatus('cancelled')}>
            Cancelar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPostponeOpen(true)}>
            Posponer…
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-700" />
          <DropdownMenuItem onClick={() => onEdit(task)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-400 focus:text-red-300"
            onClick={handleDelete}
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PostponeDialog
        taskId={task.id}
        open={postponeOpen}
        onClose={() => setPostponeOpen(false)}
        onPostponed={() => {
          onStatusChange(task.id, 'pending');
          setPostponeOpen(false);
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Create postpone-dialog.tsx**

```typescript
// src/app/(admin)/asistente/_components/postpone-dialog.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AssistantPostponeSchema, type AssistantPostponeInput } from '@/lib/assistant/schemas';
import { postponeTask } from '@/lib/assistant/actions/tasks';

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onPostponed: () => void;
}

export function PostponeDialog({ taskId, open, onClose, onPostponed }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<AssistantPostponeInput>({ resolver: zodResolver(AssistantPostponeSchema) });

  async function onSubmit(data: AssistantPostponeInput) {
    const result = await postponeTask(taskId, data);
    if (result.ok) {
      toast.success('Tarea pospuesta');
      onPostponed();
    } else {
      toast.error(result.error ?? 'Error al posponer');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Posponer tarea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pp-date">Nueva fecha</Label>
            <Input
              id="pp-date"
              type="date"
              className="bg-zinc-800 border-zinc-600"
              {...register('date')}
            />
            {errors.date && <p className="text-xs text-red-400">{errors.date.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pp-time">Nueva hora</Label>
            <Input
              id="pp-time"
              type="time"
              className="bg-zinc-800 border-zinc-600"
              {...register('time')}
            />
            {errors.time && <p className="text-xs text-red-400">{errors.time.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Posponer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant|asistente" || echo "✅ OK"
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(admin)/asistente/_components/task-card.tsx' \
        'src/app/(admin)/asistente/_components/postpone-dialog.tsx'
git commit -m "feat(asistente): TaskCard + PostponeDialog"
```

---

## Task 11: WeekGrid

**Files:**
- Create: `src/app/(admin)/asistente/_components/week-grid.tsx`

- [ ] **Step 1: Create week-grid.tsx**

```typescript
// src/app/(admin)/asistente/_components/week-grid.tsx
'use client';

import { useMemo } from 'react';
import { getWeekDays, formatInTimeZone } from '@/lib/assistant/week-helpers';
import { TIMEZONE } from '@/lib/assistant/constants';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';
import { TaskCard } from './task-card';

interface Props {
  tasks: AssistantTaskSerialized[];
  weekKey: string;
  onTaskClick: (task: AssistantTaskSerialized) => void;
  onStatusChange: (taskId: string, status: AssistantTaskSerialized['status']) => void;
  onDelete: (taskId: string) => void;
}

export function WeekGrid({ tasks, weekKey, onTaskClick, onStatusChange, onDelete }: Props) {
  const days = useMemo(() => getWeekDays(weekKey), [weekKey]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, idx) => {
        const isSunday = idx === 6;
        const dayTasks = tasks.filter((t) => {
          const taskDateMX = formatInTimeZone(new Date(t.startsAt), TIMEZONE, 'yyyy-MM-dd');
          const dayDateMX  = formatInTimeZone(day.date, TIMEZONE, 'yyyy-MM-dd');
          return taskDateMX === dayDateMX;
        });

        return (
          <div
            key={day.dayLabel}
            className="flex flex-col gap-1.5 rounded-lg p-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border:     day.isToday
                ? '1px solid rgba(59,130,246,0.5)'
                : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Column header */}
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[11px] font-medium text-zinc-400">{day.dayLabel}</span>
              <span
                className="text-sm font-semibold"
                style={{ color: day.isToday ? '#3b82f6' : '#a1a1aa' }}
              >
                {day.dayNumber}
              </span>
            </div>

            {/* Tasks */}
            {dayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onEdit={onTaskClick}
              />
            ))}

            {/* Sunday placeholder for Phase 4 */}
            {isSunday && dayTasks.length === 0 && (
              <div
                className="rounded-md p-2 mt-auto"
                style={{
                  border:     '1px dashed rgba(245,158,11,0.4)',
                  background: 'rgba(245,158,11,0.04)',
                }}
              >
                <p className="text-[10px] text-amber-500/70 leading-none mb-0.5">12:00 PM</p>
                <p className="text-[11px] text-amber-500/50">Reporte automático (Fase 4)</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

> **Note:** `formatInTimeZone` is re-exported from `week-helpers.ts` — add this export to that file:
> ```typescript
> export { formatInTimeZone } from 'date-fns-tz';
> ```

- [ ] **Step 2: Add formatInTimeZone re-export to week-helpers.ts**

Append to `src/lib/assistant/week-helpers.ts`:

```typescript
// Re-export for component use
export { formatInTimeZone } from 'date-fns-tz';
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant|asistente" || echo "✅ OK"
```

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(admin)/asistente/_components/week-grid.tsx' src/lib/assistant/week-helpers.ts
git commit -m "feat(asistente): WeekGrid 7-column layout"
```

---

## Task 12: StatsCards

**Files:**
- Create: `src/app/(admin)/asistente/_components/stats-cards.tsx`

- [ ] **Step 1: Create stats-cards.tsx**

```typescript
// src/app/(admin)/asistente/_components/stats-cards.tsx
import { STATUSES } from '@/lib/assistant/constants';
import type { WeekStats } from '@/lib/assistant/queries/stats';

interface Props {
  stats: WeekStats;
}

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {STATUSES.map((s) => {
        const count = stats.byStatus[s.value as keyof typeof stats.byStatus] ?? 0;
        const Icon  = s.icon;
        return (
          <div
            key={s.value}
            className="rounded-lg p-3 flex flex-col gap-1"
            style={{ background: `${s.color}14`, border: `1px solid ${s.color}30` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-zinc-100">{count}</span>
              <Icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: s.color }}>
              {s.label}
            </span>
            <span className="text-[10px] text-zinc-500">
              {stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}% del total
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'src/app/(admin)/asistente/_components/stats-cards.tsx'
git commit -m "feat(asistente): StatsCards 5-col grid"
```

---

## Task 13: TodayCard

**Files:**
- Create: `src/app/(admin)/asistente/_components/today-card.tsx`

- [ ] **Step 1: Create today-card.tsx**

```typescript
// src/app/(admin)/asistente/_components/today-card.tsx
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { CATEGORIES, STATUSES } from '@/lib/assistant/constants';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';

interface Props {
  tasks: AssistantTaskSerialized[];
}

function RelativeTime({ startsAt }: { startsAt: string }) {
  const [label, setLabel] = useState('Cargando…');

  useEffect(() => {
    function update() {
      setLabel(
        formatDistanceToNow(new Date(startsAt), { addSuffix: true, locale: es }),
      );
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [startsAt]);

  return <span className="text-[10px] text-zinc-500">{label}</span>;
}

export function TodayCard({ tasks }: Props) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-sm font-medium text-zinc-300">Hoy</h3>

      {tasks.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin actividades para hoy</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const category = CATEGORIES.find((c) => c.value === task.category);
            const status   = STATUSES.find((s) => s.value === task.status);
            const Icon     = status?.icon;
            return (
              <li key={task.id} className="flex items-start gap-2">
                {Icon && (
                  <Icon
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: status?.color ?? '#71717a' }}
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-zinc-200 truncate">{task.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px]"
                      style={{ color: category?.color ?? '#71717a' }}
                    >
                      {category?.label}
                    </span>
                    <span className="text-zinc-700">·</span>
                    <RelativeTime startsAt={task.startsAt} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'src/app/(admin)/asistente/_components/today-card.tsx'
git commit -m "feat(asistente): TodayCard with hydration-safe relative time"
```

---

## Task 14: CategoryDistribution + ReportStatusCard

**Files:**
- Create: `src/app/(admin)/asistente/_components/category-distribution.tsx`
- Create: `src/app/(admin)/asistente/_components/report-status-card.tsx`

- [ ] **Step 1: Create category-distribution.tsx**

```typescript
// src/app/(admin)/asistente/_components/category-distribution.tsx
import { CATEGORIES } from '@/lib/assistant/constants';
import type { WeekStats } from '@/lib/assistant/queries/stats';

interface Props {
  byCategory: WeekStats['byCategory'];
  total: number;
}

export function CategoryDistribution({ byCategory, total }: Props) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-sm font-medium text-zinc-300">Por categoría</h3>

      <div className="flex flex-col gap-2">
        {CATEGORIES.map((cat) => {
          const count = byCategory[cat.value as keyof typeof byCategory] ?? 0;
          const pct   = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={cat.value} className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px]" style={{ color: cat.color }}>{cat.label}</span>
                <span className="text-[11px] text-zinc-500">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create report-status-card.tsx**

```typescript
// src/app/(admin)/asistente/_components/report-status-card.tsx
export function ReportStatusCard() {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(245,158,11,0.04)',
        border:     '1px dashed rgba(245,158,11,0.3)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <h3 className="text-sm font-medium text-amber-400/80">Reporte semanal</h3>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-zinc-400">Domingo 12:00 PM</p>
        <p className="text-[11px] text-zinc-500">
          El bot enviará un resumen de la semana a Telegram.
        </p>
      </div>

      <div className="mt-auto pt-2 border-t border-amber-500/10">
        <p className="text-[10px] text-zinc-500">Bot conectado · @pixeltec_bot</p>
        <p className="text-[10px] text-amber-500/50">Pendiente de Fase 4</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(admin)/asistente/_components/category-distribution.tsx' \
        'src/app/(admin)/asistente/_components/report-status-card.tsx'
git commit -m "feat(asistente): CategoryDistribution + ReportStatusCard"
```

---

## Task 15: TaskFormDialog

**Files:**
- Create: `src/app/(admin)/asistente/_components/task-form-dialog.tsx`

- [ ] **Step 1: Create task-form-dialog.tsx**

```typescript
// src/app/(admin)/asistente/_components/task-form-dialog.tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CATEGORIES } from '@/lib/assistant/constants';
import { formatDateMX, formatTimeMX } from '@/lib/assistant/week-helpers';
import {
  AssistantTaskCreateSchema,
  type AssistantTaskCreateInput,
} from '@/lib/assistant/schemas';
import { createTask, updateTask } from '@/lib/assistant/actions/tasks';
import type { AssistantTaskSerialized } from '@/lib/assistant/types';

interface Props {
  open: boolean;
  task?: AssistantTaskSerialized;
  onClose: () => void;
  onSave: (task: AssistantTaskSerialized) => void;
}

export function TaskFormDialog({ open, task, onClose, onSave }: Props) {
  const isEditing = !!task;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssistantTaskCreateInput>({
    resolver: zodResolver(AssistantTaskCreateSchema),
    defaultValues: { durationMin: 60 },
  });

  // Populate form when editing
  useEffect(() => {
    if (task) {
      const startsAt = new Date(task.startsAt);
      reset({
        title:       task.title,
        description: task.description ?? undefined,
        category:    task.category,
        date:        formatDateMX(startsAt),
        time:        formatTimeMX(startsAt),
        durationMin: task.durationMin,
      });
    } else {
      reset({ durationMin: 60 });
    }
  }, [task, reset]);

  async function onSubmit(data: AssistantTaskCreateInput) {
    if (isEditing && task) {
      const result = await updateTask(task.id, data);
      if (!result.ok) {
        toast.error(result.error ?? 'Error al actualizar');
        return;
      }
      // Merge updated fields into task for optimistic update
      const updated: AssistantTaskSerialized = {
        ...task,
        title:       data.title,
        description: data.description ?? null,
        category:    data.category,
        durationMin: data.durationMin ?? 60,
        // startsAt stays same unless date/time changed — server recalculates on next load
        updatedAt:   new Date().toISOString(),
      };
      onSave(updated);
      toast.success('Tarea actualizada');
    } else {
      const result = await createTask(data);
      if (!result.ok || !result.data) {
        toast.error(result.error ?? 'Error al crear');
        return;
      }
      // Construct a serialized task for optimistic update
      const now = new Date().toISOString();
      const newTask: AssistantTaskSerialized = {
        id:          result.data.taskId,
        uid:         '',  // not shown in UI
        title:       data.title,
        description: data.description ?? null,
        category:    data.category,
        startsAt:    new Date(`${data.date}T${data.time}:00`).toISOString(),
        durationMin: data.durationMin ?? 60,
        status:      'pending',
        weekKey:     '',  // recalculated on next load
        createdAt:   now,
        updatedAt:   now,
      };
      onSave(newTask);
      toast.success('Tarea creada');
    }
    onClose();
  }

  const categoryValue = watch('category');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="tf-title">Título</Label>
            <Input
              id="tf-title"
              className="bg-zinc-800 border-zinc-600"
              placeholder="Ej: Revisar propuesta cliente X"
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="tf-desc">Descripción (opcional)</Label>
            <Textarea
              id="tf-desc"
              className="bg-zinc-800 border-zinc-600 resize-none"
              rows={2}
              placeholder="Notas adicionales…"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select
              value={categoryValue}
              onValueChange={(v) =>
                setValue('category', v as AssistantTaskCreateInput['category'])
              }
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-600">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-red-400">{errors.category.message}</p>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tf-date">Fecha</Label>
              <Input
                id="tf-date"
                type="date"
                className="bg-zinc-800 border-zinc-600"
                {...register('date')}
              />
              {errors.date && <p className="text-xs text-red-400">{errors.date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="tf-time">Hora</Label>
              <Input
                id="tf-time"
                type="time"
                className="bg-zinc-800 border-zinc-600"
                {...register('time')}
              />
              {errors.time && <p className="text-xs text-red-400">{errors.time.message}</p>}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <Label htmlFor="tf-dur">Duración (min)</Label>
            <Input
              id="tf-dur"
              type="number"
              min={15}
              max={480}
              step={15}
              className="bg-zinc-800 border-zinc-600"
              {...register('durationMin', { valueAsNumber: true })}
            />
            {errors.durationMin && (
              <p className="text-xs text-red-400">{errors.durationMin.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assistant|asistente" || echo "✅ OK"
```

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(admin)/asistente/_components/task-form-dialog.tsx'
git commit -m "feat(asistente): TaskFormDialog create+edit"
```

---

## Task 16: Final type-check + verification

- [ ] **Step 1: Full type-check**

```bash
cd /home/ubuntu/pixeltec-os
npx tsc --noEmit 2>&1 | grep -E "assistant|asistente" || echo "✅ Type check OK"
```

Expected: `✅ Type check OK`

- [ ] **Step 2: Verify file list**

```bash
find src/lib/assistant src/app/\(admin\)/asistente -type f | sort
```

Expected files:
```
src/lib/assistant/actions/tasks.ts
src/lib/assistant/constants.ts
src/lib/assistant/firebase-admin.ts
src/lib/assistant/queries/stats.ts
src/lib/assistant/queries/tasks.ts
src/lib/assistant/schemas.ts
src/lib/assistant/types.ts
src/lib/assistant/week-helpers.ts
src/app/(admin)/asistente/_components/category-distribution.tsx
src/app/(admin)/asistente/_components/postpone-dialog.tsx
src/app/(admin)/asistente/_components/report-status-card.tsx
src/app/(admin)/asistente/_components/stats-cards.tsx
src/app/(admin)/asistente/_components/task-card.tsx
src/app/(admin)/asistente/_components/task-form-dialog.tsx
src/app/(admin)/asistente/_components/today-card.tsx
src/app/(admin)/asistente/_components/week-grid.tsx
src/app/(admin)/asistente/asistente-client.tsx
src/app/(admin)/asistente/page.tsx
```

- [ ] **Step 3: Verify index in firestore.indexes.json**

```bash
python3 -c "
import json
d = json.load(open('firestore.indexes.json'))
found = any(i['collectionGroup'] == 'assistantTasks' for i in d['indexes'])
print('✅ assistantTasks index present' if found else '❌ MISSING')
"
```

- [ ] **Step 4: Final commit (if any uncommitted changes remain)**

```bash
git status
git add -p  # review and stage any remaining files
git commit -m "feat(asistente): fase 1 - vista semanal + CRUD tareas"
```

---

## Known Pitfalls (anticipated bugs)

| # | Pitfall | Mitigation in this plan |
|---|---------|------------------------|
| 1 | `new Date()` in server = UTC, hours show wrong in MX | All date math goes through `week-helpers.ts` which uses `toZonedTime` |
| 2 | weekKey at year boundary (ISO week 1 in Dec) | Using `getISOWeekYear()` not `getFullYear()` in `getWeekKeyFromDate` |
| 3 | updateTask with partial date/time | Action reads existing doc to merge date+time before recalculating |
| 4 | Hydration mismatch in `TodayCard` relative times | `useEffect` + `useState('Cargando…')` initial value until client hydrates |
| 5 | Nested Dialog crash for postpone | `PostponeDialog` is a sibling Dialog, not nested inside DropdownMenu |

---

## Deploy Commands

```bash
cd /home/ubuntu/pixeltec-os

# Stage everything
git add package.json package-lock.json \
        firestore.indexes.json \
        src/lib/assistant/ \
        'src/app/(admin)/asistente/'

git commit -m "feat(asistente): fase 1 - vista semanal + CRUD tareas"
git push origin main

# Deploy
docker compose build --no-cache app
docker compose up -d app
docker exec pixeltec-nginx nginx -s reload
docker compose logs --tail 50 app
```
