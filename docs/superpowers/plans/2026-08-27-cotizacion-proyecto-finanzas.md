# Cotización aceptada → Proyecto y Finanzas automáticos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al momento en que una Venta se vuelve cobrable (anticipo o pago total registrado), crear su Proyecto automáticamente, activar sus recurrentes (anuales y mensuales), y construir el scheduler que hoy no existe: materializar un cobro real cuando un recurrente vence, avisar por checkpoints antes de la fecha, y mostrar todo agrupado por frecuencia en Finanzas (global y por cliente).

**Architecture:** Todo cuelga de piezas que ya existen — `deriveSaleStatus`/`readyForProject` (`sales/model.ts`), `billingItems`/`recurringCharges` (ADR-0057), `getNextChargeDate` (`crm/next-charge-date.ts`). Se agrega: 4 columnas nuevas (migración aditiva), una función pura de aprovisionamiento (`sales/provision.ts`), un scheduler puro + su cron (`sales/recurring-scheduler.ts` + `api/cron/recurring-charges`), y 3 piezas de UI (card, agrupación, pestaña Finanzas). Ningún sistema paralelo de cobros — todo termina en `billing_items`/`recurring_charges`.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Drizzle ORM + Postgres, Vitest, date-fns.

**Spec:** `docs/superpowers/specs/2026-08-27-cotizacion-aceptada-proyecto-finanzas-design.md`

## Global Constraints

- No se toca `recordPayment` ni `RecordPaymentDialog` (ADR-0057) — congelados.
- No se crea ningún sistema de cobros paralelo a `billing_items`/`recurring_charges` (ADR-0057).
- `recurring_charges.frequency` sigue siendo solo `monthly`/`annual` — no se agregan valores.
- Toda migración es aditiva e idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), con comentario de reversión — mismo estilo que `drizzle/0047_sales_flow.sql`.
- Fechas de negocio (`startDate`, checkpoints) se manejan en hora LOCAL de México, nunca `toISOString()` puro — mismo criterio que `firstAnniversary()` (`sales/model.ts:100-119`).
- `git add` por nombre de archivo, nunca `-A` ni `.` (regla del repo).
- Cada tarea termina con un commit propio.

---

## Task 1: Migración de esquema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0048_sale_project_recurring_scheduler.sql`

**Interfaces:**
- Produces: columnas `sales.projectId` (uuid, nullable), `recurringCharges.reminderCycleDue` (date, nullable), `recurringCharges.reminderCheckpointsSent` (jsonb, default `[]`), `billingItems.recurringChargeId` (uuid, nullable) + índice único parcial `(recurring_charge_id, due_date) WHERE recurring_charge_id IS NOT NULL`.

- [ ] **Step 1: Agregar las columnas a `schema.ts`**

En `src/lib/db/schema.ts`, dentro de `export const sales = pgTable("sales", { ... })` (línea ~892), agrega después de `id: uuid("id").primaryKey().defaultRandom(),`:

```ts
    /** Proyecto creado automáticamente cuando la venta se vuelve cobrable
     *  (Parte A, 2026-08-27). Null hasta entonces; guarda de idempotencia. */
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
```

Y en el bloque de índices de `sales` (el array `(t) => [...]`), agrega:

```ts
    uniqueIndex("sales_project_idx").on(t.projectId),
```

En `export const recurringCharges = pgTable(...)` (línea ~695), después de `lastNotified: timestamp("last_notified", { withTimezone: true }),` agrega:

```ts
    /** Fecha (YYYY-MM-DD) del ciclo de cobro vigente que se está avisando —
     *  cuando `getNextChargeDate` avanza más allá de este valor, es un ciclo
     *  nuevo y `reminderCheckpointsSent` se reinicia (2026-08-27). */
    reminderCycleDue: date("reminder_cycle_due"),
    /** Checkpoints (días antes: 30|15|2|1) ya avisados PARA `reminderCycleDue`. */
    reminderCheckpointsSent: jsonb("reminder_checkpoints_sent").notNull().default([]),
```

En `export const billingItems = pgTable(...)` (línea ~1069), después de `projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),` agrega:

```ts
    /** El recurrente que generó este cobro al vencer (Parte C, 2026-08-27).
     *  Null para todo lo demás (pagos únicos, legado de contratos/propuestas). */
    recurringChargeId: uuid("recurring_charge_id").references(() => recurringCharges.id, { onDelete: "set null" }),
```

**No agregues el índice único parcial a `schema.ts`.** Verificado: el índice parcial equivalente que ya existe (`billing_items_sale_concept_idx ... WHERE sale_id IS NOT NULL`, migración 0047) tampoco está declarado en el bloque de índices de `billingItems` en `schema.ts` — es una convención deliberada de este repo: los índices únicos PARCIALES (con `WHERE`) viven solo en el SQL de la migración, no en `schema.ts` (drizzle-kit no los necesita para generar el resto del diff). Sigue ese mismo patrón: el índice va únicamente en el Step 3 de abajo.

Si `sql` no está importado arriba en el archivo, agrégalo al import existente de `drizzle-orm` (`import { sql } from "drizzle-orm";` o añádelo al import ya presente).

- [ ] **Step 2: Generar la migración**

Run: `npm run db:generate`

Esto crea un archivo nuevo en `drizzle/` con nombre aleatorio (p. ej. `0048_algo_random.sql`). Ábrelo, confirma que contiene exactamente los 4 `ALTER TABLE ADD COLUMN` y el índice único `sales_project_idx` (nada más — el índice parcial de `billing_items` NO va a aparecer aquí, porque no se declaró en `schema.ts` a propósito, ver Step 1; se agrega a mano en el Step 3. Si el diff trae cambios de otras tablas que no tocaste, tu `schema.ts` tenía drift previo; detente y avísalo, no lo arrastres en esta migración).

- [ ] **Step 3: Renombrar y reescribir en el estilo del repo**

Renombra el archivo a `drizzle/0048_sale_project_recurring_scheduler.sql` y reemplaza su contenido completo por:

```sql
-- 0048 — Proyecto y scheduler automáticos al aceptar/cobrar una cotización
-- (2026-08-27, ver docs/superpowers/specs/2026-08-27-cotizacion-aceptada-
-- proyecto-finanzas-design.md).
--
-- ADITIVA e IDEMPOTENTE. No modifica ninguna fila existente.
--
-- Reversión:
--   DROP INDEX IF EXISTS "billing_items_recurring_charge_due_idx";
--   ALTER TABLE billing_items DROP COLUMN IF EXISTS recurring_charge_id;
--   ALTER TABLE recurring_charges DROP COLUMN IF EXISTS reminder_cycle_due,
--     DROP COLUMN IF EXISTS reminder_checkpoints_sent;
--   DROP INDEX IF EXISTS "sales_project_idx";
--   ALTER TABLE sales DROP COLUMN IF EXISTS project_id;

-- ── 1. La Venta recuerda su Proyecto (guarda de idempotencia) ───────────────
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "project_id" uuid;
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "sales_project_idx" ON "sales" ("project_id");

-- ── 2. Recurrentes: idempotencia de avisos por checkpoint ───────────────────
-- `last_notified` (un solo timestamp) no alcanza para saber cuáles de los
-- avisos 30/15/2/1 días antes ya se mandaron en el ciclo vigente.
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "reminder_cycle_due" date;
ALTER TABLE "recurring_charges" ADD COLUMN IF NOT EXISTS "reminder_checkpoints_sent" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- ── 3. Cobros materializados desde un recurrente vencido ────────────────────
ALTER TABLE "billing_items" ADD COLUMN IF NOT EXISTS "recurring_charge_id" uuid;
DO $$ BEGIN
  ALTER TABLE "billing_items" ADD CONSTRAINT "billing_items_recurring_charge_id_recurring_charges_id_fk"
    FOREIGN KEY ("recurring_charge_id") REFERENCES "recurring_charges"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un recurrente no puede materializar dos veces el mismo período — el cron
-- puede correr dos veces el mismo día y el segundo INSERT debe no-opear, no
-- duplicar el cobro.
CREATE UNIQUE INDEX IF NOT EXISTS "billing_items_recurring_charge_due_idx"
  ON "billing_items" ("recurring_charge_id", "due_date")
  WHERE "recurring_charge_id" IS NOT NULL;
```

- [ ] **Step 4: Aplicar la migración**

Run: `npm run db:migrate`

Expected: termina sin error, imprime la migración `0048` aplicada.

- [ ] **Step 5: Verificar contra la base**

Run: `psql "$DATABASE_URL" -c "\d sales" | grep project_id && psql "$DATABASE_URL" -c "\d recurring_charges" | grep reminder && psql "$DATABASE_URL" -c "\d billing_items" | grep recurring_charge_id`

Expected: las 4 columnas nuevas aparecen.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit -p .`

Expected: sin errores nuevos (el único preexistente y ajeno es en `.next/types/.../pixelforge/runs/route.ts` — si aparece, es ese, no algo que tocaste).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0048_sale_project_recurring_scheduler.sql
git commit -m "feat(db): columnas para proyecto automático y scheduler de recurrentes"
```

---

## Task 2: `sales/provision.ts` — lógica pura (TDD)

**Files:**
- Create: `src/lib/sales/provision.ts`
- Test: `src/lib/sales/provision.test.ts`

**Interfaces:**
- Consumes: nada de otras tasks (módulo puro, sin `db`).
- Produces: `buildProjectDraft(sale, recurring): ProjectDraft`, `centsToAmount(cents): string`, `monthlyStartDate(now): string` — los usa Task 3.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `src/lib/sales/provision.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildProjectDraft, centsToAmount, monthlyStartDate } from './provision';

describe('centavos → numeric(12,2)', () => {
  it('convierte sin redondeos raros', () => {
    expect(centsToAmount(3000000)).toBe('30000.00');
    expect(centsToAmount(0)).toBe('0.00');
    expect(centsToAmount(150050)).toBe('1500.50');
  });
});

describe('buildProjectDraft', () => {
  const sale = { clientId: 'client-1', title: 'Sistema de reservaciones', oneTimeTotalCents: 3000000 };

  it('toma el nombre y el presupuesto de la venta', () => {
    const draft = buildProjectDraft(sale, []);
    expect(draft).toEqual({ clientId: 'client-1', name: 'Sistema de reservaciones', budget: '30000.00', annual: '0.00' });
  });

  it('toma el anual del recurrente de frecuencia annual, si existe', () => {
    const recurring = [
      { frequency: 'monthly' as const, amount: '100.00' },
      { frequency: 'annual' as const, amount: '899.00' },
    ];
    const draft = buildProjectDraft(sale, recurring);
    expect(draft.annual).toBe('899.00');
  });

  it('sin recurrente anual, annual queda en 0.00', () => {
    const recurring = [{ frequency: 'monthly' as const, amount: '100.00' }];
    expect(buildProjectDraft(sale, recurring).annual).toBe('0.00');
  });
});

describe('monthlyStartDate', () => {
  it('formatea la fecha LOCAL, no UTC', () => {
    // 2026-08-27 20:00 hora de México — con toISOString() puro caería al 28.
    const now = new Date(2026, 7, 27, 20, 0, 0);
    expect(monthlyStartDate(now)).toBe('2026-08-27');
  });

  it('rellena con ceros mes y día de un dígito', () => {
    const now = new Date(2026, 0, 5, 10, 0, 0);
    expect(monthlyStartDate(now)).toBe('2026-01-05');
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/sales/provision.test.ts`
Expected: FAIL — `Cannot find module './provision'`.

- [ ] **Step 3: Implementar `provision.ts` (solo la parte pura)**

Crea `src/lib/sales/provision.ts`:

```ts
/**
 * Aprovisionamiento automático al volverse la Venta cobrable (Parte A/B del
 * diseño 2026-08-27). Este módulo es PURO — sin `db`, sin `next` — para que
 * las reglas de negocio (qué se crea, con qué datos) se prueben sin tocar la
 * base. La transacción que sí toca `db` vive en `provisionProjectAndRecurrents`
 * más abajo, sin test unitario — mismo criterio que `acceptQuoteAndCreateSale`
 * en `sales/accept.ts`, que tampoco lo tiene.
 */
import 'server-only';

export interface ProjectDraft {
  clientId: string;
  name: string;
  budget: string;
  annual: string;
}

/** Centavos → `numeric(12,2)` como string — mismo criterio que `toAmount` en `accept.ts`. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface RecurringForDraft {
  frequency: 'monthly' | 'annual';
  amount: string;
}

/** Qué proyecto crear a partir de una Venta ya cobrable — función pura. */
export function buildProjectDraft(
  sale: { clientId: string; title: string; oneTimeTotalCents: number },
  recurring: readonly RecurringForDraft[],
): ProjectDraft {
  const annualCharge = recurring.find((r) => r.frequency === 'annual');
  return {
    clientId: sale.clientId,
    name: sale.title,
    budget: centsToAmount(sale.oneTimeTotalCents),
    annual: annualCharge ? annualCharge.amount : '0.00',
  };
}

/**
 * `YYYY-MM-DD` en hora LOCAL — mismo criterio que `firstAnniversary()`
 * (`sales/model.ts`): un recurrente mensual arranca el día calendario en que
 * se registró el pago, no el día UTC.
 */
export function monthlyStartDate(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/sales/provision.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales/provision.ts src/lib/sales/provision.test.ts
git commit -m "feat(sales): lógica pura del proyecto automático (Parte A/B)"
```

---

## Task 3: `provisionProjectAndRecurrents` — transacción DB, y engancharla en `syncStatus`

**Files:**
- Modify: `src/lib/sales/provision.ts`
- Modify: `src/lib/sales/queries.ts:31-52` (añadir `projectId` a `SaleRecord` y a `hydrate`)
- Modify: `src/lib/sales/actions.ts:32-36` (`syncStatus`)

**Interfaces:**
- Consumes: `buildProjectDraft`, `monthlyStartDate` (Task 2); `readyForProject`, `SaleStatus` (`sales/model.ts`, ya existen); `SaleRecord` (`sales/queries.ts`).
- Produces: `provisionProjectAndRecurrents(saleId, now?): Promise<{ projectId: string }>` — no la usa ninguna otra task de este plan, pero queda disponible para UI futura (p. ej. un botón manual de "forzar aprovisionamiento").

- [ ] **Step 1: Añadir `projectId` a `SaleRecord`**

En `src/lib/sales/queries.ts`, en la interfaz `SaleRecord` (línea ~31), agrega después de `id: string;`:

```ts
  /** Proyecto ya creado para esta venta, o `null` si aún no se aprovisiona. */
  projectId: string | null;
```

En `hydrate()`, en el `select` del join principal (línea ~72), la fila ya trae `row.sale` completo (`.select({ sale: sales, ... })`), así que `row.sale.projectId` ya está disponible sin tocar el `select`. En el `return` de `hydrate` (línea ~113), agrega:

```ts
    projectId: row.sale.projectId,
```

- [ ] **Step 2: Implementar la transacción en `provision.ts`**

Al inicio de `src/lib/sales/provision.ts`, después de `import 'server-only';`, agrega:

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingItems, projects, recurringCharges, sales } from '@/lib/db/schema';
```

Y al final del archivo:

```ts
export interface ProvisionResult {
  projectId: string;
}

/**
 * Crea el proyecto y activa los recurrentes de una Venta que ACABA de
 * volverse cobrable. Idempotente por `sales.project_id` (índice único): si ya
 * existe, no hace nada y regresa ese id — puede llamarse más de una vez sin
 * duplicar nada.
 */
export async function provisionProjectAndRecurrents(saleId: string, now: Date = new Date()): Promise<ProvisionResult> {
  return db.transaction(async (tx) => {
    const [saleRow] = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1).for('update');
    if (!saleRow) throw new Error('La venta ya no existe.');
    if (saleRow.projectId) return { projectId: saleRow.projectId };

    const recurringRows = await tx.select().from(recurringCharges).where(eq(recurringCharges.saleId, saleId));

    const draft = buildProjectDraft(saleRow, recurringRows);
    const [project] = await tx.insert(projects).values(draft).returning({ id: projects.id });

    await tx.update(sales).set({ projectId: project.id, updatedAt: new Date() }).where(eq(sales.id, saleId));
    await tx.update(billingItems).set({ projectId: project.id }).where(eq(billingItems.saleId, saleId));

    const monthlyStart = monthlyStartDate(now);
    for (const r of recurringRows) {
      await tx
        .update(recurringCharges)
        .set({
          projectId: project.id,
          status: 'active',
          active: true,
          startDate: r.frequency === 'monthly' ? monthlyStart : r.startDate,
        })
        .where(eq(recurringCharges.id, r.id));
    }

    return { projectId: project.id };
  });
}
```

- [ ] **Step 3: Enganchar en `syncStatus`**

En `src/lib/sales/actions.ts`, el archivo ya tiene `import { RECURRING_STATUSES } from './model';` — amplíala en vez de agregar una segunda línea de import del mismo módulo:

```ts
import { RECURRING_STATUSES, readyForProject } from './model';
```

Y agrega, como línea nueva, el import de la Task 3:

```ts
import { provisionProjectAndRecurrents } from './provision';
```

Reemplaza la función `syncStatus` (líneas ~32-36) por:

```ts
/** Lee la venta y, si el estado guardado quedó atrás, lo pone al día —
 *  y si ACABA de volverse cobrable, dispara el aprovisionamiento automático
 *  (Parte A/B, 2026-08-27). */
async function syncStatus(sale: SaleRecord): Promise<SaleRecord> {
  if (sale.status === sale.storedStatus) return sale;

  await db.update(sales).set({ status: sale.status, updatedAt: new Date() }).where(eq(sales.id, sale.id));
  let projectId = sale.projectId;

  if (readyForProject(sale.status) && !readyForProject(sale.storedStatus) && !sale.projectId) {
    const result = await provisionProjectAndRecurrents(sale.id);
    projectId = result.projectId;
  }

  return { ...sale, storedStatus: sale.status, projectId };
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos.

- [ ] **Step 5: Correr toda la suite de `sales` y `quotes` para confirmar que nada se rompió**

Run: `npx vitest run src/lib/sales/ src/lib/quotes/`
Expected: PASS (todo lo que ya existía sigue en verde; `provision.test.ts` sigue en verde).

- [ ] **Step 6: Verificación manual contra la app corriendo**

Con `npm run dev` levantado (worktree `wt-dashboard-cleanup`, puerto 9002): en el navegador, abre una cotización de prueba con un concepto anual y uno mensual, acéptala, registra el anticipo desde el panel de la Venta. Vuelve a abrir esa Venta (recarga) y confirma con psql:

Run: `psql "$DATABASE_URL" -c "select s.id, s.status, s.project_id, p.name, p.budget, p.annual from sales s left join projects p on p.id = s.project_id where s.id = '<el-id-de-tu-venta-de-prueba>';"`

Expected: `project_id` no nulo, `p.name` = título de la cotización, `budget`/`annual` con los montos correctos.

Run: `psql "$DATABASE_URL" -c "select concept, frequency, status, start_date from recurring_charges where sale_id = '<mismo-id>';"`

Expected: ambos (`monthly` y `annual`) en `status = 'active'`, con `start_date` no nulo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sales/provision.ts src/lib/sales/queries.ts src/lib/sales/actions.ts
git commit -m "feat(sales): crear proyecto y activar recurrentes al volverse la venta cobrable"
```

---

## Task 4: Extraer el envío de recordatorios a una función compartida

**Files:**
- Create: `src/lib/billing/reminder-notify.ts`
- Modify: `src/app/api/notifications/billing-charges/route.ts`

**Interfaces:**
- Produces: `sendBillingReminder(input: BillingReminderInput): Promise<{ emailOk: boolean }>` — la usa Task 7 (cron nuevo) y Task 8 (recordatorio manual), además de esta ruta ya existente.

- [ ] **Step 1: Crear el módulo compartido**

Crea `src/lib/billing/reminder-notify.ts`:

```ts
/**
 * Envío de recordatorio de cobro — email + WhatsApp. Extraído de
 * `api/notifications/billing-charges/route.ts` (ADR-0040) para que el cron
 * nuevo de recurrentes (Parte C/D, 2026-08-27) y el botón de recordatorio
 * manual usen EXACTAMENTE el mismo transporte, sin duplicar la plantilla.
 */
import 'server-only';
import { sendEmail } from '@/lib/email';
import { sendWhatsApp } from '@/lib/whatsapp/sender';

export interface BillingReminderInput {
  clientName: string;
  clientEmail: string | null;
  concept: string;
  amount: string;
  currency: string;
  dueDate: Date;
  overdue: boolean;
}

export interface BillingReminderResult {
  emailOk: boolean;
}

export async function sendBillingReminder(input: BillingReminderInput): Promise<BillingReminderResult> {
  const dateStr = input.dueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const amountStr = new Intl.NumberFormat('es-MX', { style: 'currency', currency: input.currency }).format(
    Number(input.amount),
  );

  let emailOk = true;
  if (input.clientEmail) {
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;"><p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p></div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">${input.overdue ? 'Cobro vencido' : 'Cobro próximo'}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
        Hola ${input.clientName}, ${input.overdue ? 'el siguiente cobro venció el' : 'el siguiente cobro vence el'}
        <strong>${dateStr}</strong>: <strong>${input.concept}</strong> — ${amountStr}.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">PixelTEC — pixeltec.mx</p>
    </div>
  </div>
</body></html>`;
    try {
      const result = await sendEmail(
        input.clientEmail,
        `${input.overdue ? 'Cobro vencido' : 'Recordatorio de cobro'} — ${input.concept}`,
        html,
      );
      emailOk = result.success;
    } catch (e) {
      emailOk = false;
      console.error('[reminder-notify] email send threw:', e instanceof Error ? e.name : typeof e);
    }
  }

  try {
    await sendWhatsApp(
      `*${input.overdue ? 'Cobro vencido' : 'Cobro próximo'} — ${input.clientName}*\n\n` +
        `*Concepto:* ${input.concept}\n*Monto:* ${amountStr}\n*Fecha:* ${dateStr}\n\npixeltec.mx/cobros`,
    );
  } catch (e) {
    console.error('[reminder-notify] whatsapp send failed:', e instanceof Error ? e.name : typeof e);
  }

  return { emailOk };
}
```

- [ ] **Step 2: Usarla desde la ruta existente, sin cambiar su comportamiento**

En `src/app/api/notifications/billing-charges/route.ts`, reemplaza los imports de `sendEmail`/`sendWhatsApp` por:

```ts
import { sendBillingReminder } from "@/lib/billing/reminder-notify";
```

Reemplaza todo el bloque que arma el `html`, llama `sendEmail`, hace push a `notifications` para email, y llama `sendWhatsApp` (desde `let emailOk = true;` hasta el `notifications.push(\`WhatsApp sent for ${item.concept}\`);`) por:

```ts
      const { emailOk } = await sendBillingReminder({
        clientName: client.name,
        clientEmail: client.email,
        concept: item.concept,
        amount: item.amount,
        currency: item.currency,
        dueDate: new Date(`${item.dueDate}T00:00:00`),
        overdue,
      });
      notifications.push(emailOk ? `Reminder sent for ${item.concept}` : `Reminder email FAILED for ${item.concept}`);
```

Deja intacto el resto (el `if (emailOk) { await db.update(...) }` que marca `remindedForDueDate`).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación manual del cron existente (no debe cambiar su comportamiento)**

Con el server local corriendo, dispara la ruta a mano:

Run: `curl -s "http://localhost:9002/api/notifications/billing-charges?secret=$CRON_SECRET" | head -c 500`

Expected: mismo tipo de respuesta JSON `{ "success": true, ... }` que antes de este cambio (compáralo contra el comportamiento documentado en el comentario de la ruta — sigue avisando cobros ≤3 días, sigue marcando `remindedForDueDate`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/reminder-notify.ts src/app/api/notifications/billing-charges/route.ts
git commit -m "refactor(billing): extraer envío de recordatorio a función compartida"
```

---

## Task 5: Checkpoints de recordatorio — lógica pura (TDD)

**Files:**
- Modify: `src/lib/crm/next-charge-date.ts`
- Create: `src/lib/crm/next-charge-date.test.ts` (no existía)

**Interfaces:**
- Consumes: nada nuevo (usa `date-fns`, ya es dependencia del archivo).
- Produces: `ANNUAL_REMINDER_CHECKPOINTS`, `MONTHLY_REMINDER_CHECKPOINTS`, `planReminders(dueDate, frequency, state, today): ReminderPlan` — los usa Task 7 (cron).

- [ ] **Step 1: Escribir los tests que fallan**

Crea `src/lib/crm/next-charge-date.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planReminders, ANNUAL_REMINDER_CHECKPOINTS, MONTHLY_REMINDER_CHECKPOINTS } from './next-charge-date';

const emptyState = { reminderCycleDue: null, reminderCheckpointsSent: [] as number[] };

describe('checkpoints anuales (30/15/1 días antes)', () => {
  it('a 30 días exactos, toca avisar el checkpoint de 30', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 6, 28); // 30 días antes
    const plan = planReminders(due, 'annual', emptyState, today);
    expect(plan.checkpointsToSend).toEqual([30]);
  });

  it('a 15 días, si el 30 ya se avisó, solo manda el de 15', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 7, 12); // 15 días antes
    const state = { reminderCycleDue: '2027-08-27', reminderCheckpointsSent: [30] };
    const plan = planReminders(due, 'annual', state, today);
    expect(plan.checkpointsToSend).toEqual([15]);
  });

  it('no repite un checkpoint ya avisado en el mismo ciclo', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 6, 28);
    const state = { reminderCycleDue: '2027-08-27', reminderCheckpointsSent: [30] };
    const plan = planReminders(due, 'annual', state, today);
    expect(plan.checkpointsToSend).toEqual([]);
  });

  it('el día de vencimiento (0 días) ya no manda avisos "antes"', () => {
    const due = new Date(2027, 7, 27);
    const today = new Date(2027, 7, 27);
    const plan = planReminders(due, 'annual', emptyState, today);
    expect(plan.checkpointsToSend).toEqual([]);
  });
});

describe('checkpoints mensuales (2/1 días antes)', () => {
  it('a 2 días, manda el checkpoint de 2', () => {
    const due = new Date(2026, 8, 27);
    const today = new Date(2026, 8, 25);
    expect(planReminders(due, 'monthly', emptyState, today).checkpointsToSend).toEqual([2]);
  });

  it('a 1 día, manda el checkpoint de 1', () => {
    const due = new Date(2026, 8, 27);
    const today = new Date(2026, 8, 26);
    expect(planReminders(due, 'monthly', emptyState, today).checkpointsToSend).toEqual([1]);
  });
});

describe('reinicio de ciclo', () => {
  it('si el próximo cobro avanzó, el ciclo es nuevo y olvida lo ya avisado', () => {
    const due = new Date(2026, 9, 27); // el recurrente ya avanzó a octubre
    const today = new Date(2026, 9, 26);
    const state = { reminderCycleDue: '2026-09-27', reminderCheckpointsSent: [2, 1] }; // ciclo viejo (septiembre)
    const plan = planReminders(due, 'monthly', state, today);
    expect(plan.isNewCycle).toBe(true);
    expect(plan.checkpointsToSend).toEqual([1]);
    expect(plan.cycleDue).toBe('2026-10-27');
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/crm/next-charge-date.test.ts`
Expected: FAIL — `planReminders is not exported`.

- [ ] **Step 3: Implementar**

En `src/lib/crm/next-charge-date.ts`, agrega el import de `differenceInCalendarDays` a la línea existente de `date-fns` (queda `import { addMonths, addYears, differenceInCalendarDays, isValid, parse } from "date-fns";`) y agrega al final del archivo:

```ts
export const ANNUAL_REMINDER_CHECKPOINTS = [30, 15, 1] as const;
export const MONTHLY_REMINDER_CHECKPOINTS = [2, 1] as const;

export interface ReminderCycleState {
  reminderCycleDue: string | null;
  reminderCheckpointsSent: number[];
}

export interface ReminderPlan {
  /** Ciclo (YYYY-MM-DD) sobre el que aplican estos avisos. */
  cycleDue: string;
  /** Checkpoints (días antes) que toca mandar HOY. */
  checkpointsToSend: number[];
  /** `true` si el ciclo cambió respecto al guardado — hay que reiniciar `reminderCheckpointsSent`. */
  isNewCycle: boolean;
}

/**
 * Qué avisos de un recurrente ACTIVO tocan hoy — función pura, sin `db`.
 *
 * Anual: 30, 15 y 1 día antes. Mensual: 2 y 1 día antes (Miguel, 2026-08-27).
 * Después de que el período vence, esta función deja de mandar avisos "antes"
 * — de ahí en adelante lo materializa `recurring-scheduler.ts` como cobro
 * pendiente y el aviso pasa a ser el de `billing-charges` (ADR-0040) o el
 * recordatorio manual.
 */
export function planReminders(
  dueDate: Date,
  frequency: Frequency,
  state: ReminderCycleState,
  today: Date,
): ReminderPlan {
  const cycleDue = dueDate.toISOString().slice(0, 10);
  const isNewCycle = state.reminderCycleDue !== cycleDue;
  const alreadySent = isNewCycle ? [] : state.reminderCheckpointsSent;
  const daysUntil = differenceInCalendarDays(dueDate, today);
  const thresholds = frequency === 'annual' ? ANNUAL_REMINDER_CHECKPOINTS : MONTHLY_REMINDER_CHECKPOINTS;
  const checkpointsToSend = thresholds.filter((t) => daysUntil <= t && daysUntil > 0 && !alreadySent.includes(t));
  return { cycleDue, checkpointsToSend, isNewCycle };
}
```

`Frequency` ya es un tipo privado del archivo (`type Frequency = "monthly" | "annual";`, línea 3) — no hace falta exportarlo, `planReminders` lo usa igual que `getNextChargeDate`.

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/crm/next-charge-date.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Correr toda la suite para confirmar que no rompiste nada**

Run: `npx vitest run src/lib/crm/ src/app/api/notifications/charges/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/crm/next-charge-date.ts src/lib/crm/next-charge-date.test.ts
git commit -m "feat(crm): checkpoints de recordatorio 30/15/2/1 días (lógica pura)"
```

---

## Task 6: Materialización de cobros vencidos — lógica pura (TDD)

**Files:**
- Create: `src/lib/sales/recurring-scheduler.ts`
- Test: `src/lib/sales/recurring-scheduler.test.ts`

**Interfaces:**
- Consumes: nada de otras tasks.
- Produces: `isChargeDue(dueDate, today): boolean`, `buildMaterializedBillingItem(charge, dueDate, currency): BillingItemDraft` — los usa Task 7 (cron).

- [ ] **Step 1: Escribir los tests que fallan**

Crea `src/lib/sales/recurring-scheduler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isChargeDue, buildMaterializedBillingItem } from './recurring-scheduler';

describe('isChargeDue', () => {
  it('todavía no vence si la fecha es futura', () => {
    expect(isChargeDue(new Date(2027, 7, 27), new Date(2027, 7, 26))).toBe(false);
  });

  it('vence exactamente el día', () => {
    expect(isChargeDue(new Date(2027, 7, 27), new Date(2027, 7, 27))).toBe(true);
  });

  it('sigue vencido si ya pasó', () => {
    expect(isChargeDue(new Date(2027, 7, 27), new Date(2027, 7, 30))).toBe(true);
  });
});

describe('buildMaterializedBillingItem', () => {
  const charge = {
    id: 'rec-1',
    saleId: 'sale-1',
    clientId: 'client-1',
    projectId: 'project-1',
    concept: 'Renovación anual COT-2026-0017',
    amount: '1042.84',
    frequency: 'annual' as const,
  };

  it('copia los datos del recurrente al borrador del cobro', () => {
    const draft = buildMaterializedBillingItem(charge, new Date(2027, 7, 27), 'MXN');
    expect(draft).toEqual({
      clientId: 'client-1',
      saleId: 'sale-1',
      projectId: 'project-1',
      recurringChargeId: 'rec-1',
      concept: 'Renovación anual COT-2026-0017',
      amount: '1042.84',
      currency: 'MXN',
      frequency: 'anual',
      status: 'pendiente',
      dueDate: '2027-08-27',
    });
  });

  it('traduce mensual → mensual (billing_frequency, no charge_frequency)', () => {
    const draft = buildMaterializedBillingItem({ ...charge, frequency: 'monthly' }, new Date(2026, 8, 27), 'MXN');
    expect(draft.frequency).toBe('mensual');
  });

  it('sin clientId truena — no se puede materializar un cobro sin cliente', () => {
    expect(() => buildMaterializedBillingItem({ ...charge, clientId: null }, new Date(2027, 7, 27), 'MXN')).toThrow(
      /sin clientId/,
    );
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/sales/recurring-scheduler.test.ts`
Expected: FAIL — `Cannot find module './recurring-scheduler'`.

- [ ] **Step 3: Implementar**

Crea `src/lib/sales/recurring-scheduler.ts`:

```ts
/**
 * Scheduler de recurrentes (Parte C del diseño, 2026-08-27): decide cuándo un
 * recurrente ACTIVO ya venció y qué `billing_item` real hay que crear para
 * ese período. Módulo puro — el cron (`api/cron/recurring-charges`) es quien
 * toca `db` y llama a estas funciones.
 *
 * Esta pieza es la que ADR-0057/WO-2026-00106 §10 dejó explícitamente fuera
 * ("no existe scheduler... ADR-0057 dejó fuera construir uno") — sin ella,
 * un recurrente vencido no tenía ningún cobro real que se pudiera pagar.
 */
import { differenceInCalendarDays } from 'date-fns';

/** `true` si el período vigente ya debió cobrarse (hoy o antes). */
export function isChargeDue(dueDate: Date, today: Date): boolean {
  return differenceInCalendarDays(dueDate, today) <= 0;
}

export interface RecurringChargeForScheduling {
  id: string;
  saleId: string | null;
  clientId: string | null;
  projectId: string | null;
  concept: string;
  amount: string;
  frequency: 'monthly' | 'annual';
}

export interface BillingItemDraft {
  clientId: string;
  saleId: string | null;
  projectId: string | null;
  recurringChargeId: string;
  concept: string;
  amount: string;
  currency: string;
  frequency: 'mensual' | 'anual';
  status: 'pendiente';
  dueDate: string;
}

const CHARGE_TO_BILLING_FREQUENCY: Record<'monthly' | 'annual', 'mensual' | 'anual'> = {
  monthly: 'mensual',
  annual: 'anual',
};

/** El `billing_item` real que hay que crear cuando un recurrente vence. */
export function buildMaterializedBillingItem(
  charge: RecurringChargeForScheduling,
  dueDate: Date,
  currency: string,
): BillingItemDraft {
  if (!charge.clientId) throw new Error(`Recurrente ${charge.id} sin clientId — no se puede materializar.`);
  return {
    clientId: charge.clientId,
    saleId: charge.saleId,
    projectId: charge.projectId,
    recurringChargeId: charge.id,
    concept: charge.concept,
    amount: charge.amount,
    currency,
    frequency: CHARGE_TO_BILLING_FREQUENCY[charge.frequency],
    status: 'pendiente',
    dueDate: dueDate.toISOString().slice(0, 10),
  };
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/sales/recurring-scheduler.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sales/recurring-scheduler.ts src/lib/sales/recurring-scheduler.test.ts
git commit -m "feat(sales): scheduler puro de materialización de recurrentes vencidos"
```

---

## Task 7: El cron — junta scheduler + checkpoints + envío

**Files:**
- Create: `src/app/api/cron/recurring-charges/route.ts`

**Interfaces:**
- Consumes: `getNextChargeDate` (`crm/next-charge-date.ts`, ya existía), `planReminders` (Task 5), `isChargeDue`/`buildMaterializedBillingItem` (Task 6), `sendBillingReminder` (Task 4).
- Produces: endpoint `GET /api/cron/recurring-charges?secret=...` — sin consumidores dentro de este plan (lo dispara el scheduler de infra, fuera de alcance de este repo).

- [ ] **Step 1: Implementar la ruta**

Crea `src/app/api/cron/recurring-charges/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingItems, clients, recurringCharges, sales } from "@/lib/db/schema";
import { assertCronExecutionAllowed, cronBlockedResponse } from "@/lib/cron-guard";
import { getNextChargeDate, planReminders } from "@/lib/crm/next-charge-date";
import { isChargeDue, buildMaterializedBillingItem } from "@/lib/sales/recurring-scheduler";
import { sendBillingReminder } from "@/lib/billing/reminder-notify";
import { toRouteFailure } from "@/lib/errors/route-failure";

/**
 * Scheduler de `recurring_charges` originados en una Venta (Parte C/D del
 * diseño 2026-08-27). Independiente de `notifications/charges` (CRM legado,
 * itera por `firestoreId`) y de `notifications/billing-charges` (ADR-0040,
 * solo `billing_items`) — mismo patrón que esos dos: cada generación de datos
 * tiene su propio scheduler, ninguno reemplaza al otro.
 *
 * Por cada recurrente `active`: si su período vigente ya venció, materializa
 * un `billing_item` real (idempotente vía el índice único
 * `(recurring_charge_id, due_date)`); si no, evalúa si toca mandar un aviso
 * (30/15 días antes para anual, 2/1 para mensual).
 */
export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertCronExecutionAllowed();
  } catch (err) {
    const blocked = cronBlockedResponse(err);
    if (blocked) return blocked;
    throw err;
  }

  try {
    const today = new Date();
    const active = await db.select().from(recurringCharges).where(eq(recurringCharges.status, "active"));

    const results: string[] = [];

    for (const charge of active) {
      if (!charge.startDate || !charge.clientId) {
        results.push(`Recurrente ${charge.id} sin startDate/clientId — omitido`);
        continue;
      }

      const [client] = await db
        .select({ name: clients.name, email: clients.email })
        .from(clients)
        .where(eq(clients.id, charge.clientId))
        .limit(1);
      if (!client) {
        results.push(`Recurrente ${charge.id}: cliente ${charge.clientId} ya no existe — omitido`);
        continue;
      }

      const dueDate = getNextChargeDate(charge.startDate, charge.frequency);

      if (isChargeDue(dueDate, today)) {
        const [saleRow] = charge.saleId
          ? await db.select({ currency: sales.currency }).from(sales).where(eq(sales.id, charge.saleId)).limit(1)
          : [];
        const draft = buildMaterializedBillingItem(
          {
            id: charge.id,
            saleId: charge.saleId,
            clientId: charge.clientId,
            projectId: charge.projectId,
            concept: charge.concept,
            amount: charge.amount,
            frequency: charge.frequency,
          },
          dueDate,
          saleRow?.currency ?? "MXN",
        );
        const [owner] = await db.select({ ownerId: clients.ownerId }).from(clients).where(eq(clients.id, charge.clientId)).limit(1);
        if (!owner) {
          results.push(`Recurrente ${charge.id}: sin ownerId de cliente — omitido`);
          continue;
        }
        const inserted = await db
          .insert(billingItems)
          .values({ ...draft, ownerId: owner.ownerId })
          .onConflictDoNothing({ target: [billingItems.recurringChargeId, billingItems.dueDate] })
          .returning({ id: billingItems.id });
        if (inserted.length > 0) {
          results.push(`Cobro materializado para ${charge.concept} (${charge.id})`);
        }
        continue; // vencido: ya no manda avisos "antes" — eso terminó
      }

      // `reminder_checkpoints_sent` es jsonb (tipo `unknown` para drizzle, mismo
      // criterio que el resto de columnas jsonb de este schema — sin
      // `.$type<>()`, se castea al leer, no en la definición de la columna).
      const reminderState = {
        reminderCycleDue: charge.reminderCycleDue,
        reminderCheckpointsSent: (charge.reminderCheckpointsSent as number[] | null) ?? [],
      };
      const plan = planReminders(dueDate, charge.frequency, reminderState, today);
      if (plan.checkpointsToSend.length === 0) continue;

      const { emailOk } = await sendBillingReminder({
        clientName: client.name,
        clientEmail: client.email,
        concept: charge.concept,
        amount: charge.amount,
        currency: "MXN",
        dueDate,
        overdue: false,
      });

      if (emailOk) {
        await db
          .update(recurringCharges)
          .set({
            reminderCycleDue: plan.cycleDue,
            reminderCheckpointsSent: [
              ...(plan.isNewCycle ? [] : reminderState.reminderCheckpointsSent),
              ...plan.checkpointsToSend,
            ],
          })
          .where(eq(recurringCharges.id, charge.id));
        results.push(`Aviso ${plan.checkpointsToSend.join(",")}d enviado para ${charge.concept}`);
      }
    }

    return NextResponse.json({ success: true, notificationsSent: results.length, details: results });
  } catch (error: unknown) {
    console.error("[recurring-charges-cron] error:", error);
    const failure = toRouteFailure(error, {
      code: "recurring_charges_cron_failed",
      message: "No se pudo procesar el cron de recurrentes.",
      status: 500,
    });
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos. Si `onConflictDoNothing({ target: [...] })` marca error de tipos por el índice parcial, cambia a `.onConflictDoNothing()` sin `target` (Postgres igual respeta el índice único al insertar) y anota en el commit por qué.

- [ ] **Step 3: Verificación manual — materialización**

Con la app corriendo, toma un `recurring_charges.id` de prueba y fuerza su `start_date` al pasado para simular que ya venció:

Run: `psql "$DATABASE_URL" -c "update recurring_charges set start_date = (current_date - interval '1 day')::date, status='active', active=true where id = '<id-de-prueba>';"`

Run: `curl -s "http://localhost:9002/api/cron/recurring-charges?secret=$CRON_SECRET"`

Expected: JSON con `"Cobro materializado para ..."` en `details`.

Run: `psql "$DATABASE_URL" -c "select concept, status, due_date, recurring_charge_id from billing_items where recurring_charge_id = '<id-de-prueba>';"`

Expected: una fila, `status = 'pendiente'`.

- [ ] **Step 4: Verificación manual — idempotencia**

Run: `curl -s "http://localhost:9002/api/cron/recurring-charges?secret=$CRON_SECRET"`

Run: `psql "$DATABASE_URL" -c "select count(*) from billing_items where recurring_charge_id = '<id-de-prueba>';"`

Expected: sigue en `1` — el segundo corrido no duplicó el cobro.

- [ ] **Step 5: Verificación manual — checkpoint de aviso**

Con otro recurrente de prueba, pon su `start_date` a 2 días en el futuro (mensual) y corre el cron de nuevo — confirma en la respuesta JSON un `"Aviso 2d enviado para ..."` y que `reminder_checkpoints_sent` quedó `[2]`:

Run: `psql "$DATABASE_URL" -c "select reminder_cycle_due, reminder_checkpoints_sent from recurring_charges where id = '<id-de-prueba-2>';"`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/recurring-charges/route.ts
git commit -m "feat(cron): scheduler de recurrentes — materializa cobros vencidos y avisa por checkpoint"
```

---

## Task 8: Recordatorio manual y consulta de recurrentes activos (server actions)

**Files:**
- Create: `src/lib/sales/recurring-view.ts`
- Modify: `src/lib/sales/actions.ts`

**Interfaces:**
- Consumes: `getNextChargeDate` (`crm/next-charge-date.ts`), `sendBillingReminder` (Task 4).
- Produces: `listActiveRecurringCharges(clientId?): Promise<RecurringChargeRow[]>`, `sendManualRecurringReminder(recurringId): Promise<ActionResult>` — los usa Task 9 (card global) y Task 10 (pestaña Finanzas).

- [ ] **Step 1: Crear la consulta de recurrentes activos**

Crea `src/lib/sales/recurring-view.ts`:

```ts
import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, recurringCharges } from '@/lib/db/schema';
import { getNextChargeDate } from '@/lib/crm/next-charge-date';

export interface RecurringChargeRow {
  id: string;
  clientId: string;
  clientName: string;
  concept: string;
  amount: string;
  frequency: 'monthly' | 'annual';
  nextChargeDate: string;
}

/** Recurrentes ACTIVOS, con su próximo cobro ya calculado (§Parte E/F/G). */
export async function listActiveRecurringCharges(clientId?: string): Promise<RecurringChargeRow[]> {
  const where = clientId
    ? and(eq(recurringCharges.status, 'active'), eq(recurringCharges.clientId, clientId))
    : eq(recurringCharges.status, 'active');

  const rows = await db
    .select({
      id: recurringCharges.id,
      clientId: recurringCharges.clientId,
      clientName: clients.name,
      concept: recurringCharges.concept,
      amount: recurringCharges.amount,
      frequency: recurringCharges.frequency,
      startDate: recurringCharges.startDate,
    })
    .from(recurringCharges)
    .innerJoin(clients, eq(clients.id, recurringCharges.clientId))
    .where(where);

  return rows
    .filter((r) => r.startDate)
    .map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.clientName,
      concept: r.concept,
      amount: r.amount,
      frequency: r.frequency as 'monthly' | 'annual',
      nextChargeDate: getNextChargeDate(r.startDate!, r.frequency as 'monthly' | 'annual').toISOString().slice(0, 10),
    }));
}
```

- [ ] **Step 2: Agregar la server action de recordatorio manual**

En `src/lib/sales/actions.ts`, el archivo ya tiene `import { recurringCharges, sales } from '@/lib/db/schema';` — amplíala para incluir `clients`:

```ts
import { clients, recurringCharges, sales } from '@/lib/db/schema';
```

Y agrega, como líneas nuevas:

```ts
import { sendBillingReminder } from '@/lib/billing/reminder-notify';
import { getNextChargeDate } from '@/lib/crm/next-charge-date';
```

Agrega al final del archivo:

```ts
/** Recordatorio manual de un recurrente — mismo transporte que el cron (§Parte E). */
export async function sendManualRecurringReminder(recurringId: string): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const [row] = await db
      .select({
        concept: recurringCharges.concept,
        amount: recurringCharges.amount,
        frequency: recurringCharges.frequency,
        startDate: recurringCharges.startDate,
        clientName: clients.name,
        clientEmail: clients.email,
      })
      .from(recurringCharges)
      .innerJoin(clients, eq(clients.id, recurringCharges.clientId))
      .where(eq(recurringCharges.id, recurringId))
      .limit(1);
    if (!row || !row.startDate) return { ok: false, error: 'El recurrente ya no existe o no tiene fecha de inicio.' };

    const dueDate = getNextChargeDate(row.startDate, row.frequency as 'monthly' | 'annual');
    await sendBillingReminder({
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      concept: row.concept,
      amount: row.amount,
      currency: 'MXN',
      dueDate,
      overdue: false,
    });

    return { ok: true };
  } catch (err) {
    return fail(err, 'manual_reminder_failed', 'No se pudo enviar el recordatorio.');
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sales/recurring-view.ts src/lib/sales/actions.ts
git commit -m "feat(sales): consulta de recurrentes activos y recordatorio manual"
```

---

## Task 9: Card "Próximos a vencer" y agrupación por frecuencia en `/cobros`

**Files:**
- Modify: `src/components/cobros/cobros-view.tsx`

**Interfaces:**
- Consumes: `listActiveRecurringCharges` (Task 8, sin `clientId` = global), `sendManualRecurringReminder` (Task 8).

- [ ] **Step 1: Cargar los recurrentes activos y filtrar los próximos a vencer**

En `src/components/cobros/cobros-view.tsx`, agrega el import:

```tsx
import { listActiveRecurringCharges, type RecurringChargeRow } from "@/lib/sales/recurring-view";
import { sendManualRecurringReminder } from "@/lib/sales/actions";
```

Dentro de `CobrosView()`, junto a los demás `useState`, agrega:

```tsx
  const [recurring, setRecurring] = useState<RecurringChargeRow[]>([]);
```

En `load` (el `useCallback` existente), después de `setItems(data);`, agrega:

```tsx
      setRecurring(await listActiveRecurringCharges());
```

Después de la declaración de `activeItems` (ya existente en el archivo), agrega:

```tsx
  const upcoming = useMemo(() => {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const horizonKey = horizon.toISOString().slice(0, 10);
    return recurring
      .filter((r) => r.nextChargeDate <= horizonKey)
      .sort((a, b) => a.nextChargeDate.localeCompare(b.nextChargeDate));
  }, [recurring]);

  const remindRecurring = useCallback(async (id: string) => {
    const res = await sendManualRecurringReminder(id);
    if (res.ok) toast.success("Recordatorio enviado.");
    else toast.error(res.error ?? "No se pudo enviar el recordatorio.");
  }, []);
```

- [ ] **Step 2: Renderizar la card "Próximos a vencer"**

En el JSX, inmediatamente antes de donde empieza a renderizarse la barra de pills (busca `{PILLS.map(`), agrega:

```tsx
      {upcoming.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Próximos a vencer (30 días)</h3>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-foreground">
                  {r.clientName} — {r.concept} · {formatCurrency(Number(r.amount))} · {formatDateES(r.nextChargeDate)}
                </span>
                <button
                  type="button"
                  onClick={() => remindRecurring(r.id)}
                  className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
                >
                  Enviar recordatorio
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
```

(Ajusta el nombre de la función de formato de moneda si `formatCurrency` no acepta un `number` directo — revisa su firma en `@/lib/utils`, ya importada en este archivo, y adáptalo si espera centavos en vez de un valor decimal.)

- [ ] **Step 3: Agrupar la tabla existente por frecuencia**

En vez de triplicar el JSX de la tabla (~50 líneas, con su versión de escritorio y su versión móvil), se ordena `filtered` por grupo de frecuencia y se inserta una fila/tarjeta de encabezado cada vez que el grupo cambia — una sola tabla, agrupada visualmente.

El archivo ya tiene `import { useState, useEffect, useCallback, useMemo } from "react";` — amplíala:

```tsx
import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
```

Justo antes de `export function CobrosView()`, agrega:

```tsx
const FREQUENCY_GROUP_ORDER: BillingFrequency[] = ["unico", "anual", "mensual", "trimestral", "semestral"];

const FREQUENCY_GROUP_LABEL: Record<BillingFrequency, string> = {
  unico: "Pago único",
  anual: "Recurrente anual",
  mensual: "Recurrente mensual",
  trimestral: "Recurrente trimestral",
  semestral: "Recurrente semestral",
};
```

Dentro de `CobrosView()`, después de la declaración de `filtered` (el `.filter()` ya existente), agrega:

```tsx
  const sortedFiltered = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => FREQUENCY_GROUP_ORDER.indexOf(a.frequency) - FREQUENCY_GROUP_ORDER.indexOf(b.frequency),
      ),
    [filtered],
  );
```

En el `<tbody className="divide-y divide-border">` de la tabla de escritorio, reemplaza `{filtered.map((item) => (` … `))}` (el `.map` que arma cada `<tr>`) por:

```tsx
                {sortedFiltered.map((item, index) => {
                  const showGroupHeader = index === 0 || sortedFiltered[index - 1].frequency !== item.frequency;
                  return (
                    <Fragment key={item.id}>
                      {showGroupHeader && (
                        <tr className="bg-secondary/20">
                          <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {FREQUENCY_GROUP_LABEL[item.frequency]}
                          </td>
                        </tr>
                      )}
                      <tr className="transition-colors hover:bg-secondary/40">
                        {/* el contenido de la fila NO cambia — son las mismas 7 <td> que ya existen hoy dentro de este .map, solo se mueven una indentación adentro del nuevo <Fragment> */}
                      </tr>
                    </Fragment>
                  );
                })}
```

Al mover el contenido, conserva EXACTAMENTE las 7 `<td>` que ya existen (Concepto, Cliente, Monto, Frecuencia, Vencimiento, Estado, Acciones) tal como están hoy — este paso solo agrega el `Fragment` y la fila de encabezado condicional alrededor, no cambia ninguna celda.

Haz lo mismo en el bloque `{/* Mobile cards */}` (`<div className="divide-y divide-border sm:hidden">`): cambia `{filtered.map((item) => (` por `{sortedFiltered.map((item, index) => { const showGroupHeader = index === 0 || sortedFiltered[index - 1].frequency !== item.frequency; return ( <Fragment key={item.id}> {showGroupHeader && (<p className="bg-secondary/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{FREQUENCY_GROUP_LABEL[item.frequency]}</p>)} <div className="space-y-2 px-4 py-4">` — el resto del `<div>` de la tarjeta queda igual, solo cerrando con `</div></Fragment> ); })}` en vez de `))}`.

- [ ] **Step 4: Levantar la app y revisar visualmente**

Run: `npm run dev` (si no sigue corriendo del Task 7) y abre `http://localhost:9002/cobros` en el navegador (sesión ya iniciada).

Expected: la card "Próximos a vencer" aparece arriba solo si hay recurrentes activos en <30 días (si no hay ninguno de prueba, créalo a mano vía la Venta de una cotización de prueba, Task 3). Las tres secciones (único/anual/mensual) se ven separadas y cada una respeta los filtros existentes.

- [ ] **Step 5: Commit**

```bash
git add src/components/cobros/cobros-view.tsx
git commit -m "feat(cobros): card próximos a vencer y agrupación por frecuencia"
```

---

## Task 10: Pestaña "Finanzas" en el workspace del cliente

**Files:**
- Modify: `src/lib/modules/client-workspace.ts`
- Create: `src/components/crm/workspace-tabs/FinanzasTab.tsx`
- Create: `src/components/crm/workspace-tabs/FinanzasTabLoader.tsx`
- Modify: `src/components/crm/ClientWorkspace.tsx`

**Interfaces:**
- Consumes: `getBillingItemsForClient` (`documents/billing.ts`, ya existe), `listActiveRecurringCharges(clientId)` (Task 8), `sendManualRecurringReminder` (Task 8).

- [ ] **Step 1: Registrar la sección nueva (ADR-0035 extendida)**

En `src/lib/modules/client-workspace.ts`, cambia el tipo:

```ts
export type ClientWorkspaceSection = "resumen" | "cotizaciones" | "proyectos" | "comercial" | "documentos" | "finanzas" | "portal";
```

Agrega al array `CLIENT_WORKSPACE_SECTIONS`, después del bloque de `documentos` y antes de `portal`:

```ts
  {
    id: "finanzas",
    label: "Finanzas",
    state: "active",
    note: "7ma pestaña fija — extiende ADR-0035 (2026-08-27, orden de Miguel). Cobros y recurrentes de ESTE cliente, agrupados por frecuencia; sin la card global de «Próximos a vencer» (esa vive en /cobros).",
  },
```

- [ ] **Step 2: Crear el componente tonto `FinanzasTab`**

Crea `src/components/crm/workspace-tabs/FinanzasTab.tsx`:

```tsx
"use client";

import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { sendManualRecurringReminder } from "@/lib/sales/actions";
import type { BillingItem } from "@/types/documents";
import type { RecurringChargeRow } from "@/lib/sales/recurring-view";

function formatDateES(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function FinanzasTab({ billingItems, recurring }: { billingItems: BillingItem[]; recurring: RecurringChargeRow[] }) {
  const unico = billingItems.filter((i) => i.frequency === "unico");
  const anual = recurring.filter((r) => r.frequency === "annual");
  const mensual = recurring.filter((r) => r.frequency === "monthly");

  const remind = async (id: string) => {
    const res = await sendManualRecurringReminder(id);
    if (res.ok) toast.success("Recordatorio enviado.");
    else toast.error(res.error ?? "No se pudo enviar el recordatorio.");
  };

  return (
    <div className="space-y-8 p-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Pago único</h3>
        {unico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cobros de pago único.</p>
        ) : (
          <div className="space-y-2">
            {unico.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span>{i.concept}</span>
                <span className="text-muted-foreground">{formatCurrency(i.amount)} · {i.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {[
        { title: "Recurrente anual", rows: anual },
        { title: "Recurrente mensual", rows: mensual },
      ].map(({ title, rows }) => (
        <section key={title}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin conceptos {title === "Recurrente anual" ? "anuales" : "mensuales"}.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{r.concept} — {formatCurrency(Number(r.amount))} · próximo cobro {formatDateES(r.nextChargeDate)}</span>
                  <button
                    type="button"
                    onClick={() => remind(r.id)}
                    className="rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
                  >
                    Enviar recordatorio
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
```

`BillingItem.amount` ya es `number` (verificado: `src/types/documents.ts`) y `formatCurrency` recibe `number` directo (`src/lib/utils.ts`) — sin `Number(...)` de por medio, a diferencia de `RecurringChargeRow.amount`, que sí es `string` (numeric de Postgres) y necesita `Number(r.amount)`.

- [ ] **Step 3: Crear el loader (mismo patrón que `CotizacionesTabLoader`)**

Crea `src/components/crm/workspace-tabs/FinanzasTabLoader.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getBillingItemsForClient } from "@/lib/documents/billing";
import { listActiveRecurringCharges } from "@/lib/sales/recurring-view";
import { FinanzasTab } from "./FinanzasTab";
import type { BillingItem } from "@/types/documents";
import type { RecurringChargeRow } from "@/lib/sales/recurring-view";

export function FinanzasTabLoader({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{ billingItems: BillingItem[]; recurring: RecurringChargeRow[] } | null>(null);

  const load = useCallback(async () => {
    const [billingItems, recurring] = await Promise.all([
      getBillingItemsForClient(clientId),
      listActiveRecurringCharges(clientId),
    ]);
    setData({ billingItems, recurring });
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (data === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return <FinanzasTab billingItems={data.billingItems} recurring={data.recurring} />;
}
```

- [ ] **Step 4: Montar la pestaña en `ClientWorkspace.tsx`**

En `src/components/crm/ClientWorkspace.tsx`, importa:

```tsx
import { FinanzasTabLoader } from "@/components/crm/workspace-tabs/FinanzasTabLoader";
```

Después del bloque `{activeTab === "documentos" && (...)}`, agrega:

```tsx
        {activeTab === "finanzas" && <FinanzasTabLoader clientId={client.id} />}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos.

- [ ] **Step 6: Verificación manual en navegador**

Abre el workspace de un cliente de prueba (el mismo que usaste en Task 3/7) en `http://localhost:9002`, confirma que aparece la pestaña "Finanzas" entre "Documentos" y "Portal", y que muestra el proyecto/cobros/recurrentes creados en las tasks anteriores, agrupados por sección.

- [ ] **Step 7: Commit**

```bash
git add src/lib/modules/client-workspace.ts src/components/crm/workspace-tabs/FinanzasTab.tsx src/components/crm/workspace-tabs/FinanzasTabLoader.tsx src/components/crm/ClientWorkspace.tsx
git commit -m "feat(crm): pestaña Finanzas en el workspace del cliente"
```

---

## Task 11: Verificación final de la suite completa

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS, incluyendo todos los tests nuevos de las Tasks 2, 5 y 6, y ninguna regresión en `sales/model.test.ts`, `quotes/terms.test.ts`, `billing/next-due.test.ts`, `billing/payment-transition.test.ts`, `notifications/charges/route.test.ts`.

- [ ] **Step 2: Tipos**

Run: `npx tsc --noEmit -p .`
Expected: sin errores nuevos (el único preexistente y ajeno sigue siendo el de `.next/types/.../pixelforge/runs/route.ts`).

- [ ] **Step 3: Smoke test completo en navegador**

Flujo de punta a punta con una cotización de prueba nueva (un concepto único, uno mensual, uno anual): crear → llenar los campos obligatorios hasta que quede "Lista" → aceptar → registrar el anticipo → confirmar proyecto creado (pestaña Proyectos del cliente) con `budget`/`annual` correctos → confirmar recurrentes `active` con fecha → pestaña Finanzas del cliente muestra los tres agrupados → `/cobros` muestra la card "Próximos a vencer" y las tres secciones → recordatorio manual desde ambos lugares no truena.

- [ ] **Step 4: Avisar a Miguel**

Reporta el resultado del smoke test con las evidencias (ids de la venta/proyecto de prueba, capturas si aplica) antes de dar el flujo por cerrado.
