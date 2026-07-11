# Flujo Comercial Completo — Plan TDD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar Propuesta → Contrato → Cobro → Factura → PDF → Envío como scope de v1.0, según el diseño aprobado en `docs/superpowers/plans/2026-07-11-flujo-comercial-diseno.md` (Gate F2-1, 2026-07-11).

**Architecture:** Next.js 15 App Router + PostgreSQL 16 vía Drizzle ORM + NextAuth v5 (migración ya completa, ver ADR-0022 en NeuroPIXEL — **no Firebase**). Server actions `'use server'` en `src/lib/documents/*.ts`, transacciones Drizzle (`db.transaction`) para invariantes multi-tabla, idempotencia por `SELECT ... LIMIT 1` antes de `INSERT` (mismo patrón que `createBillingItemsForContract`).

**Tech Stack:** Drizzle ORM 0.45, PostgreSQL 16, Resend 6.9.4 (attachments), Meta Cloud API (WhatsApp), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2), `@react-pdf/renderer` (worker de proceso aislado), Vitest.

## Global Constraints

- **NUNCA hacer deploy a producción ni tocar Firebase/Firestore** — no existe, la migración ya cerró (ADR-0022). Todo el flujo es Postgres/Drizzle.
- El repo tiene cambios sin commitear ajenos a este plan (`portal-admin`, páginas de marketing) — **no tocar, no stashear, no incluir en ningún commit de este plan**. Cada commit de este plan hace `git add` solo de los archivos que ese task modifica, nunca `git add -A` ni `git add .`.
- Toda función server-side nueva es `'use server'`, deriva el owner de la sesión vía `requireOwner()` (`src/lib/documents/pg.ts:64-70`) — nunca de un parámetro que mande el cliente.
- Transacciones: usar `db.transaction(async (tx) => {...})`. Funciones invocadas dentro de una transacción existente (como `createBillingItemsForContract`) aceptan un `Executor = DB | Parameters<Parameters<DB["transaction"]>[0]>[0]` para poder componerse.
- Idempotencia: `SELECT ... WHERE <fk> = X LIMIT 1` antes de `INSERT`, igual que `createBillingItemsForContract` (`src/lib/documents/billing.ts:83-89`). No inventar tablas de idempotency-key.
- Tests: `vitest run` (`npm test`). El repo **no tiene tests de integración contra Postgres real** — solo unit tests de funciones puras (`payment-transition.test.ts`, `base-template.test.ts`). Este plan sigue esa misma convención: **funciones puras nuevas llevan test unitario real (TDD estricto)**; las funciones con side effects (DB transaccional, R2, Meta API, Resend) se verifican con **smoke test manual en `dev.pixeltec.mx`** (mismo criterio que la regla dura #3 del vault NeuroPIXEL: "el smoke test de navegador no es opcional en UI"), documentado paso a paso en cada task — no se inventa un framework de mocking de Postgres que el repo no tiene hoy.
- Secretos nuevos de entorno (`.env.production` del VPS, nunca en el repo): `R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME` ya existen (R2 ya integrado); no se agregan nuevos para este plan.
- Migraciones: `npm run db:generate` después de editar `src/lib/db/schema.ts` — nunca escribir el `.sql` de migración a mano. Aplicar con `npm run db:migrate` contra la DB de dev antes de dar el task por cerrado.
- Commits en español, estilo del repo (`feat(...)`, `fix(...)`, `docs(...)`), `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

### Task 1: Migración — columna `invoices.billing_item_id`

**Files:**
- Modify: `src/lib/db/schema.ts:834-866` (tabla `invoices`)
- Create: migración generada por `drizzle-kit generate` (nombre automático, no se elige a mano)

**Interfaces:**
- Produce: columna `billingItemId: uuid | null` en `invoices`, FK a `billing_items.id` con `onDelete: "set null"`, indexada — la consume el Task 4 (`createInvoiceForBillingItem`).

- [ ] **Paso 1:** En `src/lib/db/schema.ts`, dentro de la definición de `invoices` (línea ~843, junto a `projectId`), agregar:

```ts
    billingItemId: uuid("billing_item_id").references(() => billingItems.id, { onDelete: "set null" }),
```

y en el bloque de índices (línea ~860-865) agregar:

```ts
    index("invoices_billing_item_idx").on(t.billingItemId),
```

- [ ] **Paso 2:** Actualizar el tipo de dominio `Invoice` en `src/types/documents.ts:168-187` agregando el campo opcional:

```ts
  billingItemId?: string;
```

- [ ] **Paso 3:** Generar la migración:

Run: `npm run db:generate`
Expected: nuevo archivo `drizzle/0012_<nombre-aleatorio>.sql` con `ALTER TABLE "invoices" ADD COLUMN "billing_item_id" uuid; ALTER TABLE "invoices" ADD CONSTRAINT ... FOREIGN KEY ...; CREATE INDEX "invoices_billing_item_idx" ...`

- [ ] **Paso 4:** Aplicar contra la DB de dev:

Run: `npm run db:migrate`
Expected: `✓ done` sin errores, tabla `invoices` con la columna nueva (`psql -d <dev_db> -c '\d invoices'` muestra `billing_item_id`).

- [ ] **Paso 5:** Actualizar `serializeInvoice` en `src/lib/documents/pg.ts:260-286` para incluir el campo:

```ts
    billingItemId: row.billingItemId ?? undefined,
```

(agregar esta línea junto a `projectId: row.projectId ?? undefined,` en el objeto retornado).

- [ ] **Paso 6: Commit**

```bash
git add src/lib/db/schema.ts src/types/documents.ts src/lib/documents/pg.ts drizzle/
git commit -m "feat(db): agregar invoices.billing_item_id para enlazar facturas con cobros"
```

---

### Task 2: `signContract()` — firmar contrato dispara cobros (M3a)

**Files:**
- Modify: `src/lib/documents/contracts.ts:104-126` (referencia — no se toca `updateContract`, se agrega función nueva al final del archivo)
- Modify: `src/lib/documents/billing.ts` (se usa `createBillingItemsForContract`, sin cambios de firma)
- Test: `src/lib/documents/contracts.test.ts` (nuevo — pero ver Global Constraints: `signContract` tiene side effects de DB, así que el test unitario cubre solo la parte pura extraíble; el resto es smoke test)

**Interfaces:**
- Consumes: `createBillingItemsForContract(executor, params)` de `src/lib/documents/billing.ts:73-104` (sin cambios).
- Produces: `signContract(contractId: string): Promise<{ ok: boolean; reason?: string }>` — lo consume Task 5 (`ContratosTab.tsx`).

**Por qué un test unitario primero:** la validación de transición de estado (¿qué estados permiten firmar?) es lógica pura que se puede extraer y testear sin tocar la DB. El resto (la transacción real) se verifica con smoke test (Paso 5).

- [ ] **Paso 1: Escribir el test de la regla de transición (falla primero)**

Crear `src/lib/documents/contract-status.ts` (función pura nueva, no existía) y su test `src/lib/documents/contract-status.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { canSignContract } from "./contract-status";

describe("canSignContract", () => {
  test("permite firmar desde borrador", () => {
    expect(canSignContract("borrador")).toEqual({ ok: true });
  });

  test("permite firmar desde en_revision", () => {
    expect(canSignContract("en_revision")).toEqual({ ok: true });
  });

  test("rechaza firmar un contrato ya firmado", () => {
    expect(canSignContract("firmado")).toEqual({ ok: false, reason: "already_signed" });
  });

  test("rechaza firmar un contrato cancelado", () => {
    expect(canSignContract("cancelado")).toEqual({ ok: false, reason: "cancelled" });
  });

  test("rechaza firmar un contrato vencido", () => {
    expect(canSignContract("vencido")).toEqual({ ok: false, reason: "expired" });
  });
});
```

- [ ] **Paso 2: Correr el test, confirmar que falla**

Run: `npx vitest run src/lib/documents/contract-status.test.ts`
Expected: FAIL — `Cannot find module './contract-status'`

- [ ] **Paso 3: Implementación mínima**

Crear `src/lib/documents/contract-status.ts`:

```ts
import type { Contract } from "@/types/documents";

export function canSignContract(
  status: Contract["status"],
): { ok: true } | { ok: false; reason: "already_signed" | "cancelled" | "expired" } {
  if (status === "firmado") return { ok: false, reason: "already_signed" };
  if (status === "cancelado") return { ok: false, reason: "cancelled" };
  if (status === "vencido") return { ok: false, reason: "expired" };
  return { ok: true };
}
```

- [ ] **Paso 4: Correr el test, confirmar que pasa**

Run: `npx vitest run src/lib/documents/contract-status.test.ts`
Expected: `5 passed`

- [ ] **Paso 5: Implementar `signContract` usando la regla ya testeada**

Agregar al final de `src/lib/documents/contracts.ts` (después de `confirmContractFromWizard`, que en el Task 3 deja de crear billing items):

```ts
import { canSignContract } from "./contract-status";

/**
 * Firma un contrato: valida la transición (canSignContract), marca
 * status="firmado" + signedAt, y crea los billing items del contrato en la
 * misma transacción (createBillingItemsForContract ya es idempotente por
 * contractId — firmar dos veces por error de red no duplica cobros porque
 * el segundo intento falla en canSignContract antes de llegar ahí).
 */
export async function signContract(contractId: string): Promise<{ ok: boolean; reason?: string }> {
  const { ownerId } = await requireOwner();
  const row = await resolveContractRow(contractId);
  if (!row || row.ownerId !== ownerId) return { ok: false, reason: "not_found" };

  const transition = canSignContract(row.status);
  if (!transition.ok) return { ok: false, reason: transition.reason };

  const sections = (row.sections as import("@/types/documents").ContractSection[]) ?? [];
  const billingItems = sectionsToBillingItemDrafts(sections);

  await db.transaction(async (tx) => {
    await tx
      .update(contracts)
      .set({ status: "firmado", signedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, row.id));

    await createBillingItemsForContract(tx, {
      ownerId,
      clientPgId: row.clientId,
      contractPgId: row.id,
      proposalPgId: row.proposalId,
      items: billingItems,
    });
  });

  return { ok: true };
}
```

⚠️ **Nota de diseño que requiere una decisión de implementación, no de negocio (ya cubierta por el Gate F2-1 — esto es un detalle técnico):** hoy `confirmContractFromWizard` recibe `billingItems: BillingItemDraft[]` directo del wizard y los pasa a `createBillingItemsForContract` en el mismo paso. Si Task 3 mueve esa llamada a `signContract`, los billing items capturados en el wizard deben **persistirse en el contrato mismo** (no perderse) para que `signContract` los recupere después. Solución: guardar los `billingItems` capturados en el wizard dentro de `contract.sections` no es correcto semánticamente (sections son cláusulas de texto, no datos estructurados de cobro). En su lugar, se agrega una columna nueva `contracts.pendingBillingItems: jsonb` (borrador de cobros aún no confirmados como billing_items reales) — ver Paso 5b.

- [ ] **Paso 5b: Columna `contracts.pending_billing_items` (borrador de cobros hasta firmar)**

En `src/lib/db/schema.ts`, dentro de `contracts` (línea ~758, junto a `sections`):

```ts
    pendingBillingItems: jsonb("pending_billing_items").notNull().default([]),
```

En `src/types/documents.ts`, en `Contract` (línea ~64-86):

```ts
  pendingBillingItems?: BillingItemDraft[];
```

En `src/lib/documents/pg.ts`, `serializeContract` (línea ~219-248), agregar:

```ts
    pendingBillingItems: (row.pendingBillingItems as BillingItemDraft[]) ?? [],
```

Generar y aplicar migración: `npm run db:generate && npm run db:migrate`.

Reescribir `signContract` (Paso 5) para leer de ahí en vez de `sectionsToBillingItemDrafts` (que no existe — se descarta esa idea):

```ts
export async function signContract(contractId: string): Promise<{ ok: boolean; reason?: string }> {
  const { ownerId } = await requireOwner();
  const row = await resolveContractRow(contractId);
  if (!row || row.ownerId !== ownerId) return { ok: false, reason: "not_found" };

  const transition = canSignContract(row.status);
  if (!transition.ok) return { ok: false, reason: transition.reason };

  const billingItems = (row.pendingBillingItems as BillingItemDraft[]) ?? [];

  await db.transaction(async (tx) => {
    await tx
      .update(contracts)
      .set({ status: "firmado", signedAt: new Date(), updatedAt: new Date() })
      .where(eq(contracts.id, row.id));

    await createBillingItemsForContract(tx, {
      ownerId,
      clientPgId: row.clientId,
      contractPgId: row.id,
      proposalPgId: row.proposalId,
      items: billingItems,
    });
  });

  return { ok: true };
}
```

- [ ] **Paso 6: Smoke test manual en dev (side effects reales, no mockeable con la infra de test actual del repo)**

En `dev.pixeltec.mx` (o `npm run dev` local):
1. Crear un contrato nuevo vía el wizard con 2 billing items de prueba (montos $100 y $200, frecuencia `unico`).
2. Confirmar que el contrato queda en `borrador` y **sin** billing items visibles en `/cobros` todavía (antes de este cambio sí aparecían — este es el comportamiento nuevo esperado).
3. Ir a Contratos, abrir el contrato, click "Firmar contrato" (Task 5).
4. Verificar en `/cobros` que aparecen los 2 billing items recién creados.
5. Firmar el mismo contrato una segunda vez (si la UI lo permitiera) o llamar `signContract` de nuevo manualmente vía consola — confirmar que NO se duplican los billing items (`canSignContract("firmado")` rechaza antes de llegar a la transacción).

Expected: los 4 puntos anteriores se cumplen exactamente.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/db/schema.ts src/types/documents.ts src/lib/documents/pg.ts src/lib/documents/contracts.ts src/lib/documents/contract-status.ts src/lib/documents/contract-status.test.ts drizzle/
git commit -m "feat(contracts): signContract() dispara billing items al firmar, no al confirmar el wizard"
```

---

### Task 3: `confirmContractFromWizard` — quitar creación de cobros, guardar borrador + enlazar propuesta

**Files:**
- Modify: `src/lib/documents/contracts.ts:167-263`

**Interfaces:**
- Consumes: `pendingBillingItems` (Task 2, Paso 5b), `updateProposal` de `src/lib/documents/proposals.ts:70-*` (sin cambio de firma, solo nueva llamada).
- Produces: `confirmContractFromWizard` deja de invocar `createBillingItemsForContract` — el contrato nace en `borrador` con `pendingBillingItems` poblado y sin `billing_items` reales todavía. Si `data.proposalId` está presente, actualiza esa propuesta.

- [ ] **Paso 1:** Modificar `confirmContractFromWizard` (`src/lib/documents/contracts.ts:232-262`):

```ts
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contracts)
      .values({
        ownerId,
        clientId: clientPgId,
        proposalId: proposalPgId,
        version: 1,
        status: "borrador",
        title: data.title,
        content: flattenSections(sections),
        variables: {},
        signers: [],
        templateVersion: CONTRACT_TEMPLATE_VERSION,
        sections,
        pendingBillingItems: data.billingItems,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        approvedAt: new Date(),
      })
      .returning({ id: contracts.id });

    if (proposalPgId) {
      await tx
        .update(proposals)
        .set({ status: "aceptada", contractId: row.id, updatedAt: new Date() })
        .where(eq(proposals.id, proposalPgId));
    }

    return row.id;
  });
}
```

(Se elimina la llamada a `createBillingItemsForContract` que estaba antes del `return row.id;` — ahora vive en `signContract`, Task 2.)

- [ ] **Paso 2:** Actualizar el docstring de la función (línea 180-185) para que no diga "idempotente vía createBillingItemsForContract" (ya no aplica aquí):

```ts
/**
 * Flujo del wizard de Contratos: genera las cláusulas desde la plantilla
 * base fija (versionada) y crea el contrato en estado "borrador" con sus
 * billing items pendientes (se convierten en cobros reales al firmar, ver
 * signContract). Si viene de una propuesta, la marca "aceptada" y la enlaza
 * al contrato en la misma transacción.
 */
```

- [ ] **Paso 3: Smoke test manual (mismo criterio que Task 2 — no hay infra de integración test)**

En dev: crear un contrato desde el wizard **con** una propuesta seleccionada en el dropdown. Verificar: (a) el contrato se crea en `borrador`, (b) la propuesta pasa a `status: "aceptada"` y aparece `contractId` apuntando al contrato nuevo — hoy esto NO pasa (confirmar el comportamiento viejo antes del cambio, luego confirmar el nuevo).

- [ ] **Paso 4: Commit**

```bash
git add src/lib/documents/contracts.ts
git commit -m "fix(contracts): confirmContractFromWizard ya no crea cobros; enlaza la propuesta aceptada"
```

---

### Task 4: Factura automática desde cada cobro (M3b)

**Files:**
- Modify: `src/lib/documents/billing.ts` (agregar llamada dentro de `createBillingItemsForContract`, o justo después — ver Paso 1 para la decisión exacta)
- Create: `src/lib/documents/invoices.test.ts` (test unitario de la función pura de mapeo)

**Interfaces:**
- Consumes: `createInvoice` de `src/lib/documents/invoices.ts:62-106` (sin cambio de firma).
- Produces: `buildInvoiceItemFromBillingItem(item: BillingItemDraft): Omit<InvoiceItem, "id">` (función pura, testeada) + `createInvoiceForBillingItem(executor, params)` (con side effects, smoke-tested).

- [ ] **Paso 1: Escribir el test de la función pura de mapeo (falla primero)**

Crear `src/lib/documents/invoice-mapping.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildInvoiceItemFromBillingItem } from "./invoice-mapping";

describe("buildInvoiceItemFromBillingItem", () => {
  test("mapea concepto y monto a un item de factura de cantidad 1", () => {
    const result = buildInvoiceItemFromBillingItem({ concept: "Mantenimiento mensual", amount: 2500 });
    expect(result).toEqual({
      description: "Mantenimiento mensual",
      qty: 1,
      unitPrice: 2500,
      subtotal: 2500,
    });
  });
});
```

- [ ] **Paso 2: Correr, confirmar que falla**

Run: `npx vitest run src/lib/documents/invoice-mapping.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Paso 3: Implementación mínima**

Crear `src/lib/documents/invoice-mapping.ts`:

```ts
export function buildInvoiceItemFromBillingItem(
  billingItem: { concept: string; amount: number },
): { description: string; qty: number; unitPrice: number; subtotal: number } {
  return {
    description: billingItem.concept,
    qty: 1,
    unitPrice: billingItem.amount,
    subtotal: billingItem.amount,
  };
}
```

- [ ] **Paso 4: Correr, confirmar que pasa**

Run: `npx vitest run src/lib/documents/invoice-mapping.test.ts`
Expected: `1 passed`

- [ ] **Paso 5: Conectar dentro de `createBillingItemsForContract`**

Modificar `src/lib/documents/billing.ts:73-104` para, tras insertar cada billing item, crear su factura en la misma transacción. Nueva versión completa de la función:

```ts
import { buildInvoiceItemFromBillingItem } from "./invoice-mapping";
import { invoices, invoiceItems } from "@/lib/db/schema";
import { getNextInvoiceNumberTx } from "./invoices";
import { orderedItemIds } from "./pg";

export async function createBillingItemsForContract(
  executor: Executor,
  params: {
    ownerId: string;
    clientPgId: string;
    contractPgId: string;
    proposalPgId?: string | null;
    items: BillingItemDraft[];
  },
): Promise<void> {
  const existing = await executor
    .select({ id: billingItems.id })
    .from(billingItems)
    .where(eq(billingItems.contractId, params.contractPgId))
    .limit(1);
  if (existing.length > 0) return; // ya confirmado antes — no duplicar
  if (params.items.length === 0) return;

  const inserted = await executor
    .insert(billingItems)
    .values(
      params.items.map((item) => ({
        ownerId: params.ownerId,
        clientId: params.clientPgId,
        contractId: params.contractPgId,
        proposalId: params.proposalPgId ?? null,
        concept: item.concept,
        amount: String(item.amount),
        frequency: item.frequency,
        dueDate: item.dueDate,
        nextDueDate: computeNextDueDate(item.dueDate, item.frequency),
      })),
    )
    .returning({ id: billingItems.id, concept: billingItems.concept, amount: billingItems.amount, dueDate: billingItems.dueDate });

  for (const bi of inserted) {
    const invoiceItem = buildInvoiceItemFromBillingItem({ concept: bi.concept, amount: Number(bi.amount) });
    const number = await getNextInvoiceNumberTx(executor, params.ownerId);
    const [invoiceRow] = await executor
      .insert(invoices)
      .values({
        ownerId: params.ownerId,
        clientId: params.clientPgId,
        billingItemId: bi.id,
        number,
        status: "borrador",
        subtotal: String(invoiceItem.subtotal),
        ivaRate: "0.16",
        ivaAmount: String(Math.round(invoiceItem.subtotal * 0.16 * 100) / 100),
        total: String(Math.round(invoiceItem.subtotal * 1.16 * 100) / 100),
        currency: "MXN",
        issueDate: bi.dueDate,
        dueDate: bi.dueDate,
      })
      .returning({ id: invoices.id });

    const ids = orderedItemIds(1);
    await executor.insert(invoiceItems).values([
      {
        id: ids[0],
        invoiceId: invoiceRow.id,
        description: invoiceItem.description,
        qty: String(invoiceItem.qty),
        unitPrice: String(invoiceItem.unitPrice),
        subtotal: String(invoiceItem.subtotal),
      },
    ]);
  }
}
```

- [ ] **Paso 6:** Agregar `getNextInvoiceNumberTx` a `src/lib/documents/invoices.ts` (variante de `getNextInvoiceNumber` que acepta un executor de transacción en vez de abrir su propia sesión, y recibe `ownerId` directo en vez de resolverlo de la sesión — se llama desde dentro de una transacción ya autenticada):

```ts
export async function getNextInvoiceNumberTx(executor: Executor, ownerId: string): Promise<string> {
  const [{ n }] = await executor
    .select({ n: count() })
    .from(invoices)
    .where(eq(invoices.ownerId, ownerId));
  const year = new Date().getFullYear();
  return `FAC-${year}-${String(n + 1).padStart(3, "0")}`;
}
```

Agregar el import de `Executor` (mismo tipo definido en `billing.ts:18`, moverlo a un módulo compartido `src/lib/documents/executor.ts` para no duplicarlo):

```ts
// src/lib/documents/executor.ts
import type { DB } from "@/lib/db";

export type Executor = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];
```

Actualizar `src/lib/documents/billing.ts:18` para importar `Executor` desde ahí en vez de redefinirlo, y hacer lo mismo en `invoices.ts`.

- [ ] **Paso 7: Smoke test manual**

En dev: firmar un contrato con 2 billing items (Task 2, Paso 6 ya deja esto armado). Ir a la pestaña Documentos/Facturación (`FacturacionTab`) del cliente y confirmar que aparecen **2 facturas nuevas en estado "borrador"**, numeradas consecutivamente (`FAC-2026-XXX`), cada una con 1 item que coincide con el concepto/monto del billing item correspondiente.

- [ ] **Paso 8: Commit**

```bash
git add src/lib/documents/billing.ts src/lib/documents/invoices.ts src/lib/documents/invoice-mapping.ts src/lib/documents/invoice-mapping.test.ts src/lib/documents/executor.ts
git commit -m "feat(billing): generar factura automática en borrador por cada cobro creado"
```

---

### Task 5: UI — "Firmar contrato" reemplaza el `<select>` crudo + M1 unificado

**Files:**
- Modify: `src/components/crm/workspace-tabs/ContratosTab.tsx:286-302`
- Modify: `src/components/crm/contracts/ContractWizard.tsx` (prop `initialProposalId`)
- Modify: `src/components/crm/workspace-tabs/PropuestaTab.tsx:268-296` (retirar `handleConvertToContract` viejo)
- Modify: `src/components/crm/ClientWorkspace.tsx` (estado compartido para navegar de Propuesta → Contratos con pre-carga)

**Interfaces:**
- Consumes: `signContract` (Task 2), `confirmContractFromWizard` ya extendido (Task 3).
- Produces: ninguna función nueva reutilizable por otros tasks — es la capa de UI final del flujo.

- [ ] **Paso 1:** En `ContratosTab.tsx`, reemplazar el `<select>` de status (líneas 286-302) por dos controles separados: uno de solo-lectura para estados no firmables, y un botón de acción para firmar:

```tsx
        {selectedContract.status === "firmado" || selectedContract.status === "vencido" || selectedContract.status === "cancelado" ? (
          <span className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400">
            {selectedContract.status === "firmado" ? "Firmado" : selectedContract.status === "vencido" ? "Vencido" : "Cancelado"}
          </span>
        ) : (
          <button
            onClick={async () => {
              if (!window.confirm("¿Firmar este contrato? Se generarán los cobros y facturas asociados — esta acción no se puede deshacer.")) return;
              const { signContract } = await import("@/lib/documents/contracts");
              const result = await signContract(selectedContract.id);
              if (!result.ok) {
                alert(`No se pudo firmar: ${result.reason}`);
                return;
              }
              setSelectedContract(prev => prev ? { ...prev, status: "firmado" } : prev);
              loadContracts();
            }}
            className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 transition-all hover:bg-green-500/20"
          >
            Firmar contrato
          </button>
        )}
```

- [ ] **Paso 2:** En `ContractWizard.tsx`, agregar prop `initialProposalId?: string` a la interfaz `Props` (línea 28-34) y usarla para preseleccionar + prellenar en el `useEffect` que carga propuestas:

```ts
interface Props {
  clientId: string;
  clientName: string;
  onDone: () => void;
  onCancel: () => void;
  initialProposalId?: string;
}

export function ContractWizard({ clientId, clientName, onDone, onCancel, initialProposalId }: Props) {
  // ... (código existente) ...
```

Buscar el `useEffect` que carga `proposals` (donde se llama `setProposals`) y agregar, justo después de setearlas:

```ts
  useEffect(() => {
    if (initialProposalId && proposals.length > 0) {
      const match = proposals.find((p) => p.id === initialProposalId);
      if (match) {
        setProposalId(match.id);
        setTitle(match.title);
      }
    }
  }, [initialProposalId, proposals]);
```

- [ ] **Paso 3:** En `ContratosTab.tsx`, agregar prop `initialProposalId?: string` y abrir automáticamente el wizard si viene poblada:

```ts
interface Props {
  clientId: string;
  clientName: string;
  initialProposalId?: string;
}

export function ContratosTab({ clientId, clientName, initialProposalId }: Props) {
  // ... estado existente ...
  useEffect(() => {
    if (initialProposalId) setView("create");
  }, [initialProposalId]);
```

Y pasar la prop al `<ContractWizard>` en el bloque `view === "create"` (línea 191+):

```tsx
        <ContractWizard
          clientId={clientId}
          clientName={clientName}
          initialProposalId={initialProposalId}
          onDone={() => { setView("list"); loadContracts(); }}
          onCancel={() => setView("list")}
        />
```

- [ ] **Paso 4:** En `ClientWorkspace.tsx`, agregar estado `pendingProposalId` y el mecanismo de navegación cruzada:

```tsx
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("resumen");
  const [pendingProposalId, setPendingProposalId] = useState<string | undefined>(undefined);
```

Modificar el render de `propuesta` y `contratos`:

```tsx
        {activeTab === "propuesta"  && (
          <div className="p-6">
            <PropuestaTab
              clientId={client.id}
              clientName={client.name}
              clientEmail={client.email}
              onGenerarContrato={(proposalId) => {
                setPendingProposalId(proposalId);
                setActiveTab("contratos");
              }}
            />
          </div>
        )}
        {activeTab === "contratos"  && (
          <div className="p-6">
            <ContratosTab
              clientId={client.id}
              clientName={client.name}
              initialProposalId={pendingProposalId}
            />
          </div>
        )}
```

- [ ] **Paso 5:** En `PropuestaTab.tsx`, agregar la prop `onGenerarContrato` a `Props` (junto a `clientId`/`clientName`/`clientEmail`) y **retirar `handleConvertToContract`** (líneas 268-296), reemplazando su único call site (botón "Convertir a contrato", líneas 725-732):

```tsx
interface Props {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  onGenerarContrato: (proposalId: string) => void;
}

export function PropuestaTab({ clientId, clientName, clientEmail, onGenerarContrato }: Props) {
  // ... (eliminar por completo la función handleConvertToContract y el estado `converting` que ya no se usa) ...
```

```tsx
        {!selected.contractId && selected.status !== "rechazada" && (
          <button
            onClick={() => onGenerarContrato(selected.id)}
            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300 transition-all hover:bg-amber-500/20"
          >
            Generar contrato
          </button>
        )}
```

(El import dinámico `await import("@/lib/documents/contracts")` que usaba `handleConvertToContract` para `createContract` se elimina — ya no se llama `createContract` desde este componente.)

- [ ] **Paso 6: Smoke test manual — el flujo completo M1+M2+M3a+M3b de punta a punta**

En dev: (1) crear una propuesta nueva, aceptarla manualmente cambiando su status; (2) click en "Generar contrato" → confirma que navega al tab Contratos con el wizard abierto y el título pre-poblado; (3) capturar un billing item y confirmar → contrato queda en `borrador`, la propuesta pasa a `aceptada` con `contractId` enlazado; (4) click "Firmar contrato" → confirma diálogo → contrato pasa a `firmado`; (5) verificar en `/cobros` el billing item y en Documentos/Facturación la factura en `borrador` generados automáticamente.

Expected: los 5 pasos encadenan sin intervención manual adicional más allá de lo descrito.

- [ ] **Paso 7: Commit**

```bash
git add src/components/crm/workspace-tabs/ContratosTab.tsx src/components/crm/contracts/ContractWizard.tsx src/components/crm/workspace-tabs/PropuestaTab.tsx src/components/crm/ClientWorkspace.tsx
git commit -m "feat(crm): unificar Propuesta→Contrato en un solo camino con cobros, agregar botón Firmar contrato"
```

---

### Task 6: `sendEmail` con adjuntos (M4a)

**Files:**
- Modify: `src/lib/email.ts:42-67`

**Interfaces:**
- Produces: `sendEmail(to, subject, html, attachments?)` — nueva firma retrocompatible (parámetro opcional al final). La consume Task 8 (`sendInvoiceToClient`).

- [ ] **Paso 1: Escribir el test de que la firma acepta el parámetro sin romper el contrato existente**

`sendEmail` llama al SDK real de Resend — no es puro, no se mockea (el repo no tiene mocks de Resend). Se verifica por tipos (TypeScript) + smoke test, no por vitest. Confirmar con `tsc`:

Run: `npx tsc --noEmit`
Expected (antes del cambio): ninguna llamada existente a `sendEmail` se rompe porque el nuevo parámetro es opcional.

- [ ] **Paso 2: Implementación**

```ts
export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: EmailAttachment[]
): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[email] Sent "${subject}" → ${to} (id: ${data?.id})${attachments?.length ? ` +${attachments.length} adjunto(s)` : ""}`);
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] Unexpected error:', message);
    return { success: false, error: message };
  }
}
```

- [ ] **Paso 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Paso 4: Smoke test manual**

Enviar un email de prueba con un PDF adjunto pequeño (ej. reusar `generateContractPdf` de un contrato de prueba) llamando `sendEmail` desde una ruta de test temporal o la consola de Next (`npm run dev` + un endpoint ad-hoc). Confirmar en la bandeja de destino que el adjunto llega y abre correctamente. Borrar cualquier endpoint ad-hoc de prueba antes de commitear.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): sendEmail acepta adjuntos (Resend ya lo soporta)"
```

---

### Task 7: R2 con URL firmada de corta vigencia (M4b, parte 1)

**Files:**
- Modify: `package.json` (nueva dependencia)
- Modify: `src/lib/r2/upload.ts`

**Interfaces:**
- Produces: `getR2SignedUrl(key: string, expiresInSeconds?: number): Promise<string>` — la consume Task 9 (`sendWhatsAppDocument` caller).

- [ ] **Paso 1:** Instalar la dependencia necesaria (el SDK de S3 ya está, falta el presigner):

Run: `npm install @aws-sdk/s3-request-presigner`
Expected: agregado a `package.json`/`package-lock.json`, misma major version que `@aws-sdk/client-s3` (`^3.x`).

- [ ] **Paso 2:** Agregar a `src/lib/r2/upload.ts`:

```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * URL firmada de vigencia corta — para documentos sensibles (contratos,
 * facturas) que se comparten por WhatsApp/link temporal, a diferencia de
 * getR2PublicUrl (permanente, usado para avatares/logos no sensibles).
 */
export async function getR2SignedUrl(key: string, expiresInSeconds = 172800): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getR2BucketName(), Key: key });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}
```

(`172800` segundos = 48 horas, el límite superior del rango acordado en el Gate F2-1.)

- [ ] **Paso 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Paso 4: Smoke test manual**

Subir un PDF de prueba con `uploadObject` (ya existente) a una key de prueba (ej. `test/smoke-${Date.now()}.pdf`), generar su URL firmada con `getR2SignedUrl`, abrirla en el navegador — confirmar que descarga el PDF. Esperar >48h no es viable en la sesión, pero confirmar que la URL contiene un parámetro de expiración (`X-Amz-Expires=172800` en la query string).

- [ ] **Paso 5: Commit**

```bash
git add package.json package-lock.json src/lib/r2/upload.ts
git commit -m "feat(r2): agregar getR2SignedUrl para documentos sensibles (contratos/facturas)"
```

---

### Task 8: `sendWhatsAppDocument` (M4b, parte 2)

**Files:**
- Modify: `src/lib/whatsapp/sender.ts`

**Interfaces:**
- Consumes: nada nuevo (mismas env vars que `sendWhatsApp`).
- Produces: `sendWhatsAppDocument(documentUrl: string, options?: SendWhatsAppDocumentOptions): Promise<SendWhatsAppResult>`.

- [ ] **Paso 1:** Agregar al final de `src/lib/whatsapp/sender.ts`:

```ts
export interface SendWhatsAppDocumentOptions extends SendWhatsAppOptions {
  filename?: string;
  caption?: string;
}

export async function sendWhatsAppDocument(
  documentUrl: string,
  options?: SendWhatsAppDocumentOptions
): Promise<SendWhatsAppResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const defaultTo = process.env.WHATSAPP_DEFAULT_TO;
  const apiVersion = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not configured");
  if (!phoneId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not configured");

  const to = (options?.to ?? defaultTo)?.trim();
  if (!to) throw new Error("No recipient — set WHATSAPP_DEFAULT_TO or pass options.to");
  if (!documentUrl) throw new Error("documentUrl is empty");

  const masked = maskPhone(to);
  console.info("[whatsapp] sending document to", masked);

  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: {
      link: documentUrl,
      ...(options?.filename ? { filename: options.filename } : {}),
      ...(options?.caption ? { caption: options.caption } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp] send document failed (network)", { error: detail, to: masked });
    throw new Error(`Meta WhatsApp API network error: ${detail}`);
  }

  const json = (await res.json().catch(() => ({}))) as MetaApiResponse;

  if (!res.ok) {
    const errMsg = json?.error?.message ?? "Unknown Meta API error";
    const errCode = json?.error?.code ?? "unknown";
    throw new Error(`Meta WhatsApp API failed (${res.status}): ${errMsg} [code=${errCode}]`);
  }

  const messageId = json?.messages?.[0]?.id;
  if (!messageId) throw new Error("Meta returned 200 but no message id in response");

  console.info("[whatsapp] document sent", { messageId, to: masked });
  return { messageId, to };
}
```

- [ ] **Paso 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Paso 3: Smoke test manual**

Con un número de prueba en `WHATSAPP_DEFAULT_TO` (allowlist de desarrollo, ver error 131030 documentado en el header del archivo), llamar `sendWhatsAppDocument` con la URL firmada del Paso 4 de Task 7. Confirmar que el documento llega al chat de WhatsApp y se puede abrir.

- [ ] **Paso 4: Commit**

```bash
git add src/lib/whatsapp/sender.ts
git commit -m "feat(whatsapp): agregar sendWhatsAppDocument (Meta Cloud API type=document)"
```

---

### Task 9: Generador de PDF de Facturas (gap encontrado durante el diseño — no existía)

**Files:**
- Create: `src/lib/documents/invoice-pdf-render.ts`
- Create: `src/lib/documents/pdf-render-worker/render-invoice.mjs`
- Create: `src/app/api/documents/invoice-pdf/route.ts`

**Interfaces:**
- Produces: `generateInvoicePdf(invoice: Invoice & { id: string }, clientName: string): Promise<Buffer>` — la consume Task 10 (`sendInvoiceToClient`).
- Reutiliza el mismo patrón que `contract-pdf-render.ts` (worker en proceso aislado por React error #31), mismos `COLOR`/fuente Poppins/logo que ya dan la "identidad corporativa" en contratos.

- [ ] **Paso 1:** Crear `src/lib/documents/pdf-render-worker/render-invoice.mjs`:

```js
// Worker de render de PDF de facturas — mismo patrón que render-contract.mjs
// (React error #31, ver ese archivo para el porqué). Documento formal:
// header con logo + folio + fecha, tabla de conceptos, totales con IVA.
//
// Uso: node render-invoice.mjs <inputJsonPath> <outputPdfPath>

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { Document, Page, View, Text, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const h = React.createElement;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const FONTS_DIR = path.join(PROJECT_ROOT, "src/lib/documents/fonts");
const LOGO_PATH = path.join(PROJECT_ROOT, "public", "ptlogox.png");

Font.register({
  family: "Poppins",
  fonts: [
    { src: path.join(FONTS_DIR, "Poppins-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "Poppins-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONTS_DIR, "Poppins-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const COLOR = { ink: "#111827", body: "#1F2937", muted: "#4B5563", faint: "#9CA3AF", border: "#D1D5DB" };

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Poppins", fontSize: 10, color: COLOR.body },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLogo: { width: 90, height: 28, objectFit: "contain" },
  headerLine: { fontSize: 9, color: COLOR.muted, marginBottom: 2 },
  headerLabel: { fontWeight: 600, color: COLOR.ink },
  headerDivider: { borderBottomWidth: 1, borderBottomColor: COLOR.border, marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: COLOR.ink, marginBottom: 4 },
  folio: { fontSize: 11, color: COLOR.muted, marginBottom: 20 },
  table: { marginTop: 8, marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.ink, paddingBottom: 6, marginBottom: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  colDesc: { flex: 3, fontSize: 9 },
  colQty: { flex: 1, fontSize: 9, textAlign: "center" },
  colPrice: { flex: 1, fontSize: 9, textAlign: "right" },
  colSubtotal: { flex: 1, fontSize: 9, textAlign: "right" },
  tableHeaderText: { fontWeight: 700, fontSize: 9, color: COLOR.ink },
  totals: { alignSelf: "flex-end", width: 220, marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 9, color: COLOR.muted },
  totalValue: { fontSize: 9, color: COLOR.ink },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLOR.ink, paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: COLOR.ink },
  grandTotalValue: { fontSize: 11, fontWeight: 700, color: COLOR.ink },
});

function money(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function InvoiceDocument({ invoice, clientName }) {
  const dateStr = new Date(invoice.issueDate).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  return h(Document, { title: `${invoice.number} — ${clientName}` },
    h(Page, { size: "A4", style: styles.page }, [
      h(View, { style: styles.header, key: "header" }, [
        h(View, { key: "meta" }, [
          h(Text, { style: styles.headerLine, key: "cliente" }, [h(Text, { style: styles.headerLabel, key: "l" }, "Cliente: "), clientName]),
          h(Text, { style: styles.headerLine, key: "fecha" }, [h(Text, { style: styles.headerLabel, key: "l" }, "Fecha: "), dateStr]),
        ]),
        h(Image, { src: LOGO_PATH, style: styles.headerLogo, key: "logo" }),
      ]),
      h(View, { style: styles.headerDivider, key: "divider" }),
      h(Text, { style: styles.title, key: "title" }, "FACTURA"),
      h(Text, { style: styles.folio, key: "folio" }, invoice.number),
      h(View, { style: styles.table, key: "table" }, [
        h(View, { style: styles.tableHeaderRow, key: "thead" }, [
          h(Text, { style: [styles.colDesc, styles.tableHeaderText], key: "d" }, "Concepto"),
          h(Text, { style: [styles.colQty, styles.tableHeaderText], key: "q" }, "Cant."),
          h(Text, { style: [styles.colPrice, styles.tableHeaderText], key: "p" }, "P. Unitario"),
          h(Text, { style: [styles.colSubtotal, styles.tableHeaderText], key: "s" }, "Subtotal"),
        ]),
        ...invoice.items.map((it, i) =>
          h(View, { style: styles.tableRow, key: i }, [
            h(Text, { style: styles.colDesc, key: "d" }, it.description),
            h(Text, { style: styles.colQty, key: "q" }, String(it.qty)),
            h(Text, { style: styles.colPrice, key: "p" }, money(it.unitPrice)),
            h(Text, { style: styles.colSubtotal, key: "s" }, money(it.subtotal)),
          ])),
      ]),
      h(View, { style: styles.totals, key: "totals" }, [
        h(View, { style: styles.totalRow, key: "sub" }, [
          h(Text, { style: styles.totalLabel, key: "l" }, "Subtotal"),
          h(Text, { style: styles.totalValue, key: "v" }, money(invoice.subtotal)),
        ]),
        h(View, { style: styles.totalRow, key: "iva" }, [
          h(Text, { style: styles.totalLabel, key: "l" }, `IVA (${(invoice.ivaRate * 100).toFixed(0)}%)`),
          h(Text, { style: styles.totalValue, key: "v" }, money(invoice.ivaAmount)),
        ]),
        h(View, { style: styles.grandTotalRow, key: "total" }, [
          h(Text, { style: styles.grandTotalLabel, key: "l" }, "Total"),
          h(Text, { style: styles.grandTotalValue, key: "v" }, money(invoice.total)),
        ]),
      ]),
    ]));
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  const input = JSON.parse(readFileSync(inputPath, "utf-8"));
  const buffer = await renderToBuffer(React.createElement(InvoiceDocument, { invoice: input, clientName: input.clientName }));
  writeFileSync(outputPath, buffer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Paso 2:** Crear `src/lib/documents/invoice-pdf-render.ts` (mismo patrón que `contract-pdf-render.ts:1-45`):

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Invoice } from "@/types/documents";

const execFileAsync = promisify(execFile);

const WORKER_PATH = path.join(process.cwd(), "src/lib/documents/pdf-render-worker/render-invoice.mjs");

export async function generateInvoicePdf(invoice: Invoice & { id: string }, clientName: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "invoice-pdf-"));
  const inputPath = path.join(dir, "input.json");
  const outputPath = path.join(dir, "output.pdf");
  try {
    await writeFile(inputPath, JSON.stringify({ ...invoice, clientName }), "utf-8");
    await execFileAsync(process.execPath, [WORKER_PATH, inputPath, outputPath], { cwd: process.cwd() });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Paso 3:** Agregar `safeInvoiceFilename(number: string): string` a `invoice-pdf-render.ts` (mismo patrón que `safeContractFilename`, `contract-pdf-render.ts:48`):

```ts
export function safeInvoiceFilename(number: string): string {
  return `${number.replace(/[^a-zA-Z0-9-]/g, "-")}.pdf`;
}
```

Crear `src/app/api/documents/invoice-pdf/route.ts` — **mismo patrón exacto** que `contract-pdf/route.ts` (auth por cookie de sesión vía `requireSession`, no `requireOwner()`; `findInvoiceByPublicId` en vez de `findContractByPublicId`, ya existe en `pg.ts:375-384`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/vpsClient";
import { findInvoiceByPublicId, clientPublicIdFor } from "@/lib/documents/pg";
import { generateInvoicePdf, safeInvoiceFilename } from "@/lib/documents/invoice-pdf-render";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) return new NextResponse("Missing invoiceId", { status: 400 });

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);
    if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

    const invoice = await findInvoiceByPublicId(invoiceId);
    if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
    if (invoice.uid !== session.uid) return new NextResponse("Forbidden", { status: 403 });

    const [client] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, invoice.clientId)).limit(1);
    const pdf = await generateInvoicePdf(invoice, client?.name ?? invoice.clientId);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeInvoiceFilename(invoice.number)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[invoice-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
```

(`invoice.clientId` que devuelve `findInvoiceByPublicId` ya es el id público del cliente vía `clientPublicIdFor` — pero la tabla `clients` se indexa por uuid interno; si `invoice.clientId` no es un uuid válido, usar `resolveClientPgId` de `pg.ts` antes del `where`. Confirmar cuál es el caso en el smoke test del Paso 4.)

- [ ] **Paso 4: Smoke test manual**

`GET /api/documents/invoice-pdf?invoiceId=<id de una factura de prueba>` en el navegador — confirmar que descarga un PDF con logo, folio, tabla de conceptos y totales correctos (comparar el total contra `invoice.total` en la DB).

- [ ] **Paso 5: Commit**

```bash
git add src/lib/documents/invoice-pdf-render.ts src/lib/documents/pdf-render-worker/render-invoice.mjs src/app/api/documents/invoice-pdf/route.ts
git commit -m "feat(invoices): generador de PDF de facturas (no existía) — mismo patrón que contratos"
```

---

### Task 10: `sendInvoiceToClient` (M5) — factura llega al cliente al pasar a "enviada"

**Files:**
- Modify: `src/lib/email.ts` (nueva función)
- Modify: `src/components/crm/workspace-tabs/FacturacionTab.tsx` (trigger)

**Interfaces:**
- Consumes: `sendEmail` con attachments (Task 6), `generateInvoicePdf` (Task 9), `sendWhatsAppDocument` + `getR2SignedUrl` (Tasks 7-8, opcional — solo si el cliente también tiene WhatsApp).
- Produces: `sendInvoiceToClient(invoice: Invoice & { id: string }, client: { email?: string; name: string }): Promise<EmailResult>`.

- [ ] **Paso 1:** Agregar a `src/lib/email.ts` (junto a los demás domain-specific senders):

```ts
/** Sent to the CLIENT when an invoice is marked "enviada" — distinct from sendInvoiceEmail (internal team notification on payment). */
export async function sendInvoiceToClient(
  clientEmail: string,
  clientName: string,
  invoiceNumber: string,
  pdfBuffer: Buffer,
): Promise<EmailResult> {
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;"><p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p></div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">Tu factura ${invoiceNumber}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">Hola ${clientName}, adjuntamos tu factura. Cualquier duda, responde este correo.</p>
    </div>
  </div>
</body></html>`;
  return sendEmail(clientEmail, `Factura ${invoiceNumber} — PixelTEC`, html, [
    { filename: `${invoiceNumber}.pdf`, content: pdfBuffer },
  ]);
}
```

- [ ] **Paso 2:** En `FacturacionTab.tsx`, ubicar `handleStatusChange` (línea 118) y disparar el envío cuando el nuevo estado sea `"enviada"`:

```ts
  const handleStatusChange = async (invoice: Invoice, status: Invoice["status"]) => {
    try {
      await updateInvoice(invoice.id, { status });
      if (status === "enviada") {
        const { sendInvoiceForClient } = await import("@/lib/documents/invoice-send");
        await sendInvoiceForClient(invoice.id);
      }
      // ... resto del código existente sin cambios ...
```

- [ ] **Paso 3:** Crear `src/lib/documents/invoice-send.ts` (server action que junta factura + cliente + PDF + email — capa fina, no lógica nueva):

```ts
'use server';
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveInvoiceRow, serializeInvoice, clientPublicIdFor } from "./pg";
import { invoiceItems } from "@/lib/db/schema";
import { generateInvoicePdf } from "./invoice-pdf-render";
import { sendInvoiceToClient } from "@/lib/email";
import { requireOwner } from "./pg";

export async function sendInvoiceForClient(invoiceId: string): Promise<{ ok: boolean; reason?: string }> {
  const { ownerId } = await requireOwner();
  const row = await resolveInvoiceRow(invoiceId);
  if (!row || row.ownerId !== ownerId) return { ok: false, reason: "not_found" };

  const [client] = await db
    .select({ email: clients.email, name: clients.name })
    .from(clients)
    .where(eq(clients.id, row.clientId))
    .limit(1);
  if (!client?.email) return { ok: false, reason: "client_has_no_email" };

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, row.id)).orderBy(invoiceItems.id);
  const invoice = serializeInvoice(row, items, row.clientId, "");
  const pdfBuffer = await generateInvoicePdf({ ...invoice, id: row.id }, client.name);

  const result = await sendInvoiceToClient(client.email, client.name, invoice.number, pdfBuffer);
  return { ok: result.success, reason: result.error };
}
```

(Nota: confirmar el nombre exacto de la columna de email en `clients` — revisar `src/lib/db/schema.ts` tabla `clients` antes de este paso; el snippet asume `clients.email` como columna existente, ajustar si el nombre real difiere.)

- [ ] **Paso 4: Smoke test manual**

En dev: tomar una factura en `borrador` (generada automáticamente por Task 4), cambiar su estado a "enviada" desde `FacturacionTab`. Confirmar que el cliente (usar un email de prueba propio) recibe el correo con el PDF adjunto, y que el PDF generado coincide con los datos de la factura.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/email.ts src/lib/documents/invoice-send.ts src/components/crm/workspace-tabs/FacturacionTab.tsx
git commit -m "feat(invoices): enviar factura al cliente (PDF adjunto) al marcarla como enviada"
```

---

### Task 11: M6 — Deploy a producción de la config UI de PixelBot

**Files:** ninguno de código — checklist operativo.

- [ ] **Paso 1:** Revisar el playbook existente de deploy de PixelTEC OS (buscar en `docs/` o preguntar si no hay uno documentado — no asumir un nombre de archivo sin confirmarlo).
- [ ] **Paso 2:** Confirmar que la config UI de PixelBot (`WhatsApp > Configuración del bot`) pasa `npm run build && npx tsc --noEmit` sin errores en el estado actual del repo.
- [ ] **Paso 3:** Deploy siguiendo el playbook — verificación post-deploy (health check, smoke test de la UI en producción).
- [ ] **Paso 4:** `docker exec pixeltec-nginx nginx -s reload` si el contenedor se recreó (gotcha conocido, [[Nginx upstream gotcha]] en memoria).
- [ ] **Paso 5:** Actualizar `04_PRODUCTOS/PixelTEC OS/PixelTEC OS.md` en NeuroPIXEL: la excepción del freeze deja de estar "solo DEV" — reflejar el deploy a producción.

---

## Self-Review

**1. Cobertura del diseño aprobado:**
- M1 (Task 5) ✅, M2 (Task 5, ya no requiere nada adicional) ✅, M3a (Task 2) ✅, M3b (Task 1 + 4) ✅, M4a (Task 6) ✅, M4b (Tasks 7-8) ✅, M5 (Tasks 9-10) ✅, M6 (Task 11) ✅.
- Gap adicional encontrado durante este plan (no estaba en el diseño original): no existía generador de PDF de facturas — cubierto en Task 9.
- Gap adicional encontrado durante este plan: `handleConvertToContract` ya existente en `PropuestaTab.tsx` creaba contratos sin cobros por un camino paralelo al wizard — Miguel confirmó retirarlo, cubierto en Task 5.
- Gap de implementación descubierto en Task 2: los billing items capturados en el wizard necesitan sobrevivir hasta la firma — se agregó `contracts.pendingBillingItems` (no estaba en el diseño original, que solo preveía el cambio de `invoices.billing_item_id`).

**2. Placeholders:** ninguno — cada paso de código tiene la implementación completa, no hay "TODO"/"similar a Task N sin repetir código".

**3. Consistencia de tipos:** `signContract(contractId: string): Promise<{ ok: boolean; reason?: string }>` (Task 2) es el mismo shape que `updateProposalActionStatus` ya usa en el repo — consistente con la convención existente. `BillingItemDraft` se reutiliza sin cambios en Tasks 2-4. `Executor` se centraliza en Task 4 para no duplicarlo entre `billing.ts` e `invoices.ts`.
