# Portal de Clientes v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un portal de clientes nuevo y único (`/portal`, acceso por correo + código OTP) que reemplaza los tres sistemas borrados, más un panel admin separado (`/portal-admin`) para activar el acceso y publicar actualizaciones — sin duplicar datos del CRM.

**Architecture:** Server components para las rutas (`/portal`, `/portal-admin`), server actions por dominio en `src/lib/client-portal/` (mismo patrón que `src/lib/documents/`), sesión propia por cookie HMAC firmada (no NextAuth), datos leídos directo de las tablas reales del CRM (`projects`, `contracts`, `finances`, `tickets`, `clientPortalUpdates`).

**Tech Stack:** Next.js 15 App Router, Drizzle/Postgres, Zod, Resend (`sendEmail`), Vitest, Tailwind + shadcn/ui, `node:crypto` (HMAC-SHA256, no librería externa de JWT).

## Global Constraints

- Ruta pública única `/portal` (sin slug ni token) + panel admin plano `/portal-admin` (sin prefijo `/admin/...` — el proyecto no usa esa convención).
- Cookie de sesión: httpOnly, secure, sameSite=lax, firmada HMAC con `PORTAL_SESSION_SECRET`, `exp` explícito en el payload, 7 días.
- Solo **una** columna nueva en la base de datos: `clients.portalAccessEnabled boolean not null default false`. Todo lo demás reusa columnas/tablas existentes.
- OTP: `HMAC-SHA256(code, PORTAL_SESSION_SECRET)`, expira en 10 minutos, un solo uso (se limpia al verificar).
- Mensaje genérico anti-enumeración en toda solicitud de código, salvo el rate-limit por IP (que sí se muestra honesto, porque no filtra si un correo existe).
- Correos duplicados entre clientes → rechazo determinístico, nunca autenticación al azar.
- `clients.portalAccessEnabled` se revalida en cada carga del dashboard y en la descarga de contrato — no basta con que la cookie sea válida.
- El control admin vive en `/portal-admin`, separado de `ClientWorkspace`/`/clientes/[id]`, porque `useCRM()` solo expone clientes `source='crm_blob'` (3 de 13 clientes reales) — no se toca `useCRM()`/`crm-sync.ts`.
- Seguir la convención existente del proyecto: capa de datos `pg.ts` + archivos de server actions por dominio bajo `src/lib/<dominio>/`, sin carpeta `services/` nueva.
- `node_modules/.bin/tsc --noEmit` y `npm run lint` deben quedar limpios (sin errores nuevos) antes de dar cualquier tarea por completa.
- Sin deploy a producción bajo ninguna circunstancia — solo verificación en `dev.pixeltec.mx` con clientes de prueba creados y borrados en la misma sesión.
- Spec completa: `docs/superpowers/specs/2026-07-09-portal-clientes-design.md`.

---

### Task 1: Migración — `clients.portalAccessEnabled`

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/XXXX_<auto>.sql` (generado por `drizzle-kit generate`, nombre no predecible)

**Interfaces:**
- Produces: columna `clients.portalAccessEnabled: boolean` (Drizzle: `boolean("portal_access_enabled").notNull().default(false)`), consumida por todas las tareas siguientes vía `clients.portalAccessEnabled`.

- [ ] **Step 1: Agregar la columna al schema**

En `src/lib/db/schema.ts`, dentro de la definición de la tabla `clients` (busca el bloque que empieza en `export const clients = pgTable(`), agrega la columna nueva junto a las demás de portal existentes (después de `legacyPortalEnabled` y antes del cierre del objeto de columnas, justo antes de `documents: jsonb("documents")...`):

```ts
    // Portal de Clientes v2 (2026-07-09) — interruptor único, independiente
    // de portalEnabled/legacyPortalEnabled (sistemas viejos borrados). Único
    // campo nuevo del proyecto — ver docs/superpowers/specs/2026-07-09-portal-clientes-design.md.
    portalAccessEnabled: boolean("portal_access_enabled").notNull().default(false),
    documents: jsonb("documents").notNull().default([]), // ClientDocument[]
```

- [ ] **Step 2: Generar la migración**

Run: `npm run db:generate`
Expected: crea un archivo nuevo `drizzle/00XX_<nombre-aleatorio>.sql` que contiene exactamente:
```sql
ALTER TABLE "clients" ADD COLUMN "portal_access_enabled" boolean DEFAULT false NOT NULL;
```

- [ ] **Step 3: Verificar el SQL generado**

Abre el archivo nuevo y confirma que solo tiene esa única línea `ALTER TABLE` (sin cambios inesperados a otras columnas/tablas). Si `drizzle-kit` generó algo más, detente y revisa qué cambió en `schema.ts` sin querer antes de continuar.

- [ ] **Step 4: Aplicar la migración**

Run: `npm run db:migrate`
Expected: log de éxito de drizzle-kit aplicando la migración nueva contra `DATABASE_URL` (dev).

- [ ] **Step 5: Verificar la columna en la base**

Run: `npm run db:studio` (o una query directa) y confirma que `clients.portal_access_enabled` existe, tipo boolean, default `false`, `NOT NULL`, y que las filas existentes quedaron en `false`.

- [ ] **Step 6: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores (el schema sigue siendo válido).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): agregar clients.portalAccessEnabled para Portal de Clientes v2"
```

---

### Task 2: Módulo puro de OTP (`src/lib/client-portal/otp.ts`)

**Files:**
- Create: `src/lib/client-portal/otp.ts`
- Test: `src/lib/client-portal/otp.test.ts`

**Interfaces:**
- Produces: `generateAccessCode(): string`, `hashAccessCode(code: string, secret: string): string`, `accessCodeMatches(storedHash: string, code: string, secret: string): boolean` — consumidos por Task 7 (`auth-actions.ts`).

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/client-portal/otp.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { generateAccessCode, hashAccessCode, accessCodeMatches } from "./otp";

describe("generateAccessCode", () => {
  test("returns a 6-digit numeric string", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateAccessCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashAccessCode", () => {
  test("is deterministic for the same code and secret", () => {
    expect(hashAccessCode("123456", "secret")).toBe(hashAccessCode("123456", "secret"));
  });

  test("differs for different codes", () => {
    expect(hashAccessCode("123456", "secret")).not.toBe(hashAccessCode("654321", "secret"));
  });

  test("differs for different secrets", () => {
    expect(hashAccessCode("123456", "secret-a")).not.toBe(hashAccessCode("123456", "secret-b"));
  });
});

describe("accessCodeMatches", () => {
  test("returns true for the correct code", () => {
    const hash = hashAccessCode("123456", "secret");
    expect(accessCodeMatches(hash, "123456", "secret")).toBe(true);
  });

  test("returns false for an incorrect code", () => {
    const hash = hashAccessCode("123456", "secret");
    expect(accessCodeMatches(hash, "654321", "secret")).toBe(false);
  });

  test("returns false for a malformed stored hash", () => {
    expect(accessCodeMatches("not-a-hex-hash", "123456", "secret")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/client-portal/otp.test.ts`
Expected: FAIL — `Cannot find module './otp'` (el archivo `otp.ts` todavía no existe).

- [ ] **Step 3: Implementación mínima**

Crea `src/lib/client-portal/otp.ts`:

```ts
import crypto from "node:crypto";

/** Código de acceso de 6 dígitos, con ceros a la izquierda si aplica. */
export function generateAccessCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash HMAC del código — nunca se guarda el código en texto plano. */
export function hashAccessCode(code: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

/** Comparación en tiempo constante del hash guardado contra un código candidato. */
export function accessCodeMatches(storedHash: string, code: string, secret: string): boolean {
  const providedHash = hashAccessCode(code, secret);
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(providedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/client-portal/otp.test.ts`
Expected: PASS — 7 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client-portal/otp.ts src/lib/client-portal/otp.test.ts
git commit -m "feat(client-portal): módulo puro de generación/hash de OTP"
```

---

### Task 3: Módulo puro de sesión firmada (`src/lib/client-portal/session-token.ts`)

**Files:**
- Create: `src/lib/client-portal/session-token.ts`
- Test: `src/lib/client-portal/session-token.test.ts`

**Interfaces:**
- Produces: `interface PortalSessionPayload { clientId: string; exp: number }`, `signPortalSessionToken(payload: PortalSessionPayload, secret: string): string`, `verifyPortalSessionToken(token: string, secret: string, now: number): PortalSessionPayload | null` — consumidos por Task 4 (`cookie.ts`).

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/client-portal/session-token.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { signPortalSessionToken, verifyPortalSessionToken } from "./session-token";

const SECRET = "test-secret";
const NOW = 1_700_000_000_000;

describe("signPortalSessionToken / verifyPortalSessionToken", () => {
  test("round-trips a valid token", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW + 1000 }, SECRET);
    expect(verifyPortalSessionToken(token, SECRET, NOW)).toEqual({ clientId: "client-1", exp: NOW + 1000 });
  });

  test("rejects an expired token", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW - 1000 }, SECRET);
    expect(verifyPortalSessionToken(token, SECRET, NOW)).toBeNull();
  });

  test("rejects a token signed with a different secret", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW + 1000 }, SECRET);
    expect(verifyPortalSessionToken(token, "wrong-secret", NOW)).toBeNull();
  });

  test("rejects a tampered payload", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW + 1000 }, SECRET);
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ clientId: "client-2", exp: NOW + 1000 }),
      "utf-8",
    ).toString("base64url");
    expect(verifyPortalSessionToken(`${tamperedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("rejects a malformed token", () => {
    expect(verifyPortalSessionToken("not-a-valid-token", SECRET, NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/client-portal/session-token.test.ts`
Expected: FAIL — `Cannot find module './session-token'`.

- [ ] **Step 3: Implementación mínima**

Crea `src/lib/client-portal/session-token.ts`:

```ts
import crypto from "node:crypto";

export interface PortalSessionPayload {
  clientId: string;
  exp: number;
}

function sign(payloadB64: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Firma un payload de sesión de portal como `<payload-b64url>.<firma-b64url>`. */
export function signPortalSessionToken(payload: PortalSessionPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/** Verifica firma + expiración. `now` se pasa explícito (no `Date.now()` interno) para poder testear determinísticamente. */
export function verifyPortalSessionToken(token: string, secret: string, now: number): PortalSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: PortalSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (typeof payload.clientId !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp <= now) return null;
  return payload;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/client-portal/session-token.test.ts`
Expected: PASS — 5 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client-portal/session-token.ts src/lib/client-portal/session-token.test.ts
git commit -m "feat(client-portal): módulo puro de firma/verificación de sesión HMAC"
```

---

### Task 4: Cookie de sesión (`src/lib/client-portal/cookie.ts`)

**Files:**
- Create: `src/lib/client-portal/cookie.ts`

**Interfaces:**
- Consumes: `signPortalSessionToken`, `verifyPortalSessionToken`, `PortalSessionPayload` (Task 3, `./session-token`).
- Produces: `createPortalSessionCookie(publicClientId: string): Promise<void>`, `readPortalSessionClientId(): Promise<string | null>`, `clearPortalSessionCookie(): Promise<void>` — consumidos por Task 7, Task 10, Task 13.

- [ ] **Step 1: Implementación**

Crea `src/lib/client-portal/cookie.ts`:

```ts
import { cookies } from "next/headers";
import { signPortalSessionToken, verifyPortalSessionToken } from "./session-token";

const COOKIE_NAME = "__client_portal_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function getSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET no está configurado.");
  return secret;
}

/** `publicClientId` = `clients.firestoreId ?? clients.id` — mismo formato que usa el resto de la app (ver `publicDocId` en `src/lib/documents/pg.ts`). */
export async function createPortalSessionCookie(publicClientId: string): Promise<void> {
  const token = signPortalSessionToken({ clientId: publicClientId, exp: Date.now() + SESSION_TTL_MS }, getSecret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Devuelve el `publicClientId` de la sesión vigente, o `null` si no hay cookie / es inválida / expiró. */
export async function readPortalSessionClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = verifyPortalSessionToken(token, getSecret(), Date.now());
  return result?.clientId ?? null;
}

export async function clearPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

- [ ] **Step 2: Confirmar la env var en desarrollo**

Run: `grep PORTAL_SESSION_SECRET .env.local .env.production 2>/dev/null`
Expected: la variable ya existe (quedó del sistema de portal viejo, según `pixeltec-os-info.md`). Si no aparece en `.env.local`, agrégala con un valor aleatorio largo (`openssl rand -hex 32`) antes de continuar — sin este valor, cualquier request al portal lanza `Error: PORTAL_SESSION_SECRET no está configurado.`.

- [ ] **Step 3: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/client-portal/cookie.ts
git commit -m "feat(client-portal): cookie de sesión httpOnly firmada"
```

---

### Task 5: Capa de datos (`src/lib/client-portal/pg.ts`)

**Files:**
- Create: `src/lib/client-portal/pg.ts`

**Interfaces:**
- Consumes: `publicDocId`, `requireOwner`, `resolveClientPgId` (ya existentes, exportados de `src/lib/documents/pg.ts`); tablas `clients`, `projects`, `contracts`, `finances`, `tickets`, `clientPortalUpdates` de `@/lib/db/schema`.
- Produces:
  - `interface PortalClientMatch { id: string; publicId: string; name: string; email: string; portalAccessEnabled: boolean }`
  - `findSinglePortalClientByEmail(email: string): Promise<PortalClientMatch | null>`
  - `getClientCodeState(clientPgId: string): Promise<{ accessCodeHash: string | null; accessCodeExpiresAt: Date | null; lastCodeRequestAt: Date | null } | null>`
  - `setClientAccessCode(clientPgId: string, hash: string, expiresAt: Date): Promise<void>`
  - `clearClientAccessCode(clientPgId: string): Promise<void>`
  - `isPortalAccessEnabled(clientPgId: string): Promise<boolean>`
  - `interface PortalDashboardData { clientName: string; projects: {...}[]; invoices: {...}[]; contracts: {...}[]; tickets: {...}[]; updates: {...}[] }`
  - `getPortalDashboardData(clientPgId: string): Promise<PortalDashboardData | null>`
  - `interface PortalAdminClientRow { id: string; name: string; email: string | null; portalAccessEnabled: boolean }`
  - `listAllClientsForPortalAdmin(ownerId: string): Promise<PortalAdminClientRow[]>`
  - `setPortalAccessEnabled(clientPgId: string, ownerId: string, enabled: boolean): Promise<boolean>`
  - `publishPortalUpdate(clientPgId: string, ownerId: string, update: { text: string; imageUrl: string | null; createdBy: string }): Promise<string | null>`
  - Consumidos por Task 7, Task 8, Task 10, Task 13, Task 14.

- [ ] **Step 1: Implementación**

Crea `src/lib/client-portal/pg.ts`:

```ts
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, projects, contracts, finances, tickets, clientPortalUpdates } from "@/lib/db/schema";
import { publicDocId } from "@/lib/documents/pg";

// ── Identidad por correo (login) ─────────────────────────────────────────────

export interface PortalClientMatch {
  id: string; // clients.id interno (uuid)
  publicId: string; // firestoreId ?? id — se guarda en la sesión
  name: string;
  email: string;
  portalAccessEnabled: boolean;
}

/**
 * Busca clientes por correo exacto (case-insensitive). Si hay 0 o más de 1
 * coincidencia, devuelve `null` — el caller trata ambos casos igual
 * (mensaje genérico, sin autenticar contra una fila al azar).
 */
export async function findSinglePortalClientByEmail(email: string): Promise<PortalClientMatch | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const rows = await db
    .select({
      id: clients.id,
      firestoreId: clients.firestoreId,
      name: clients.name,
      email: clients.email,
      portalAccessEnabled: clients.portalAccessEnabled,
    })
    .from(clients)
    .where(sql`lower(${clients.email}) = ${normalized}`);

  if (rows.length !== 1) return null;
  const row = rows[0];
  if (!row.email) return null;

  return {
    id: row.id,
    publicId: publicDocId(row),
    name: row.name,
    email: row.email,
    portalAccessEnabled: row.portalAccessEnabled,
  };
}

// ── Estado del código OTP ────────────────────────────────────────────────────

export async function getClientCodeState(clientPgId: string): Promise<{
  accessCodeHash: string | null;
  accessCodeExpiresAt: Date | null;
  lastCodeRequestAt: Date | null;
} | null> {
  const [row] = await db
    .select({
      accessCodeHash: clients.accessCodeHash,
      accessCodeExpiresAt: clients.accessCodeExpiresAt,
      lastCodeRequestAt: clients.lastCodeRequestAt,
    })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return row ?? null;
}

export async function setClientAccessCode(clientPgId: string, hash: string, expiresAt: Date): Promise<void> {
  await db
    .update(clients)
    .set({ accessCodeHash: hash, accessCodeExpiresAt: expiresAt, lastCodeRequestAt: new Date() })
    .where(eq(clients.id, clientPgId));
}

export async function clearClientAccessCode(clientPgId: string): Promise<void> {
  await db
    .update(clients)
    .set({ accessCodeHash: null, accessCodeExpiresAt: null })
    .where(eq(clients.id, clientPgId));
}

// ── Interruptor de acceso ─────────────────────────────────────────────────────

export async function isPortalAccessEnabled(clientPgId: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: clients.portalAccessEnabled })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return row?.enabled ?? false;
}

// ── Dashboard del cliente ─────────────────────────────────────────────────────

export interface PortalDashboardData {
  clientName: string;
  projects: { id: string; name: string; status: string }[];
  invoices: { id: string; projectName: string | null; amount: string; status: string; date: string }[];
  contracts: { id: string; title: string; version: number; status: string }[];
  tickets: { id: string; ticketId: string; problema: string; estado: string }[];
  updates: { id: string; text: string; imageUrl: string | null; createdBy: string; createdAt: string }[];
}

/**
 * Revalida `portalAccessEnabled` en vivo — devuelve `null` si el cliente no
 * existe o el portal está desactivado, sin importar si la cookie es válida.
 */
export async function getPortalDashboardData(clientPgId: string): Promise<PortalDashboardData | null> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientPgId)).limit(1);
  if (!client || !client.portalAccessEnabled) return null;

  const [projectRows, contractRows, invoiceRows, ticketRows, updateRows] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(eq(projects.clientId, clientPgId))
      .orderBy(projects.name),
    db
      .select({ id: contracts.id, title: contracts.title, version: contracts.version, status: contracts.status })
      .from(contracts)
      .where(and(eq(contracts.clientId, clientPgId), eq(contracts.status, "firmado")))
      .orderBy(desc(contracts.version)),
    // finances/tickets: matching por nombre de cliente (deuda técnica heredada,
    // ver docs/superpowers/specs/2026-07-09-portal-clientes-design.md).
    db
      .select({
        id: finances.id,
        projectName: finances.projectName,
        amount: finances.amount,
        status: finances.status,
        date: finances.date,
      })
      .from(finances)
      .where(eq(finances.clientName, client.name))
      .orderBy(desc(finances.date))
      .limit(20),
    db
      .select({ id: tickets.id, ticketId: tickets.ticketId, problema: tickets.problema, estado: tickets.estado })
      .from(tickets)
      .where(eq(tickets.cliente, client.name))
      .orderBy(desc(tickets.createdAt))
      .limit(20),
    db
      .select({
        id: clientPortalUpdates.id,
        text: clientPortalUpdates.text,
        imageUrl: clientPortalUpdates.imageUrl,
        createdBy: clientPortalUpdates.createdBy,
        createdAt: clientPortalUpdates.createdAt,
      })
      .from(clientPortalUpdates)
      .where(eq(clientPortalUpdates.clientId, clientPgId))
      .orderBy(desc(clientPortalUpdates.createdAt))
      .limit(20),
  ]);

  return {
    clientName: client.name,
    projects: projectRows,
    invoices: invoiceRows.map((r) => ({ ...r, date: r.date.toISOString() })),
    contracts: contractRows,
    tickets: ticketRows,
    updates: updateRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

// ── Panel admin (todos los clientes, sin filtro de source) ──────────────────

export interface PortalAdminClientRow {
  id: string; // id público — el que reciben las acciones admin
  name: string;
  email: string | null;
  portalAccessEnabled: boolean;
}

/**
 * Todos los clientes del owner, SIN el filtro `source='crm_blob'` que usa
 * `useCRM()`/`getFullCrmData()` — el control del portal debe alcanzar a los
 * 13 clientes reales, no solo a los que aparecen en /clientes. Capa de datos
 * independiente, no toca `crm-sync.ts`.
 */
export async function listAllClientsForPortalAdmin(ownerId: string): Promise<PortalAdminClientRow[]> {
  const rows = await db
    .select({
      id: clients.id,
      firestoreId: clients.firestoreId,
      name: clients.name,
      email: clients.email,
      portalAccessEnabled: clients.portalAccessEnabled,
    })
    .from(clients)
    .where(eq(clients.ownerId, ownerId))
    .orderBy(clients.name);

  return rows.map((row) => ({
    id: publicDocId(row),
    name: row.name,
    email: row.email,
    portalAccessEnabled: row.portalAccessEnabled,
  }));
}

/** Devuelve `false` si `clientPgId` no pertenece a `ownerId` (sin actualizar nada). */
export async function setPortalAccessEnabled(clientPgId: string, ownerId: string, enabled: boolean): Promise<boolean> {
  const result = await db
    .update(clients)
    .set({ portalAccessEnabled: enabled })
    .where(and(eq(clients.id, clientPgId), eq(clients.ownerId, ownerId)))
    .returning({ id: clients.id });
  return result.length > 0;
}

/** Devuelve el id de la actualización creada, o `null` si `clientPgId` no pertenece a `ownerId`. */
export async function publishPortalUpdate(
  clientPgId: string,
  ownerId: string,
  update: { text: string; imageUrl: string | null; createdBy: string },
): Promise<string | null> {
  const [owned] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientPgId), eq(clients.ownerId, ownerId)))
    .limit(1);
  if (!owned) return null;

  const [inserted] = await db
    .insert(clientPortalUpdates)
    .values({
      clientId: clientPgId,
      text: update.text,
      imageUrl: update.imageUrl,
      createdBy: update.createdBy,
    })
    .returning({ id: clientPortalUpdates.id });
  return inserted.id;
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores. Si `publicDocId` no es importable, confirma que sigue exportado en `src/lib/documents/pg.ts` (`export function publicDocId(row: { id: string; firestoreId: string | null }): string`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/client-portal/pg.ts
git commit -m "feat(client-portal): capa de datos — login por correo, dashboard, panel admin"
```

---

### Task 6: Email del código de acceso (`src/emails/ClientPortalAccessEmail.ts`)

**Files:**
- Create: `src/emails/ClientPortalAccessEmail.ts`

**Interfaces:**
- Consumes: `clientLayout`, `escapeHtml` de `./shared` (ya existentes, mismo patrón que `PasswordResetEmail.ts`).
- Produces: `interface ClientPortalAccessEmailProps { clientName: string; code: string; expiresIn: string; portalUrl: string }`, `renderClientPortalAccessEmail(props): string` — consumido por Task 7.

- [ ] **Step 1: Implementación**

Crea `src/emails/ClientPortalAccessEmail.ts`:

```ts
/**
 * Código de acceso al portal de clientes — enviado a `clients.email` cuando
 * el cliente solicita entrar a /portal.
 */

import { clientLayout, escapeHtml } from './shared';

export interface ClientPortalAccessEmailProps {
  clientName: string;
  code: string;
  expiresIn: string;
  portalUrl: string;
}

export function renderClientPortalAccessEmail(props: ClientPortalAccessEmailProps): string {
  const { clientName, code, expiresIn, portalUrl } = props;

  return clientLayout({
    title: 'Tu código de acceso — PixelTEC',
    subtitle: 'Portal de Clientes',
    body: `
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:1.5px;">
        C&oacute;digo de acceso
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#ffffff;">
        Hola, ${escapeHtml(clientName)}
      </h1>
      <p style="margin:0 0 28px;font-size:15px;color:#a1a1aa;line-height:1.5;">
        Usa este c&oacute;digo para entrar a tu portal en <a href="${portalUrl}" style="color:#06b6d4;">${portalUrl}</a>.
      </p>

      <div style="text-align:center;margin:0 0 28px;">
        <span style="display:inline-block;background:#18181b;border:1px solid #292524;color:#ffffff;font-weight:700;font-size:32px;letter-spacing:0.4em;padding:16px 24px;border-radius:10px;">
          ${escapeHtml(code)}
        </span>
      </div>

      <div style="background:#1c1917;border:1px solid #292524;border-radius:10px;padding:14px 18px;margin-bottom:28px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#78716c;">
          &#9201; Este c&oacute;digo expira en <strong style="color:#f5f5f4;">${escapeHtml(expiresIn)}</strong> y solo puede usarse una vez.
        </p>
      </div>

      <p style="margin:28px 0 0;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
        Si no solicitaste este c&oacute;digo, puedes ignorar este mensaje.
      </p>`,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/emails/ClientPortalAccessEmail.ts
git commit -m "feat(client-portal): plantilla de email del código de acceso"
```

---

### Task 7: Server actions públicas (`src/lib/client-portal/auth-actions.ts`)

**Files:**
- Create: `src/lib/client-portal/auth-actions.ts`

**Interfaces:**
- Consumes: `generateAccessCode`, `hashAccessCode`, `accessCodeMatches` (Task 2); `createPortalSessionCookie`, `clearPortalSessionCookie` (Task 4); `findSinglePortalClientByEmail`, `getClientCodeState`, `setClientAccessCode`, `clearClientAccessCode` (Task 5); `renderClientPortalAccessEmail` (Task 6); `sendEmail` (`@/lib/email`, ya existente); `enforceRateLimit` (`@/lib/rate-limit`, ya existente); `PortalActionResult` (`@/lib/action-types`, ya existente).
- Produces: `requestClientPortalCodeAction(email: string): Promise<PortalActionResult<{ message: string }>>`, `verifyClientPortalCodeAction(email: string, code: string): Promise<PortalActionResult<null>>`, `logoutClientPortalAction(): Promise<void>` — consumidos por Task 11 (login UI) y Task 12 (logout button).

- [ ] **Step 1: Implementación**

Crea `src/lib/client-portal/auth-actions.ts`:

```ts
'use server';

import { headers } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import type { PortalActionResult } from '@/lib/action-types';
import { renderClientPortalAccessEmail } from '@/emails/ClientPortalAccessEmail';
import { generateAccessCode, hashAccessCode, accessCodeMatches } from './otp';
import { createPortalSessionCookie, clearPortalSessionCookie } from './cookie';
import {
  findSinglePortalClientByEmail,
  getClientCodeState,
  setClientAccessCode,
  clearClientAccessCode,
} from './pg';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos
const OTP_CLIENT_RATE_LIMIT_MS = 60 * 1000; // 60s entre solicitudes por cliente
const OTP_IP_MAX = 10;
const OTP_IP_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// Mismo mensaje para: correo inexistente, portal desactivado, correo duplicado
// entre clientes, Y rate-limit por cliente — ninguno de esos casos debe ser
// distinguible desde afuera (anti-enumeración + anti-ambigüedad). Solo el
// rate-limit por IP se muestra honesto, porque no depende de si el correo existe.
const GENERIC_OTP_MESSAGE = 'Si el correo existe y tiene el portal activo, te enviamos un código de acceso.';

function portalSessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error('PORTAL_SESSION_SECRET no está configurado.');
  return secret;
}

export async function requestClientPortalCodeAction(email: string): Promise<PortalActionResult<{ message: string }>> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return { success: true, data: { message: GENERIC_OTP_MESSAGE } };

  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? headersList.get('x-real-ip') ?? 'unknown';
  const rl = await enforceRateLimit({ ip, bucket: 'client_portal_otp', max: OTP_IP_MAX, windowMs: OTP_IP_WINDOW_MS });
  if (!rl.allowed) {
    return { success: false, error: 'Demasiadas solicitudes. Inténtalo más tarde.' };
  }

  const client = await findSinglePortalClientByEmail(trimmedEmail);
  if (!client || !client.portalAccessEnabled) {
    return { success: true, data: { message: GENERIC_OTP_MESSAGE } };
  }

  const codeState = await getClientCodeState(client.id);
  if (
    codeState?.lastCodeRequestAt &&
    Date.now() - codeState.lastCodeRequestAt.getTime() < OTP_CLIENT_RATE_LIMIT_MS
  ) {
    return { success: true, data: { message: GENERIC_OTP_MESSAGE } };
  }

  const code = generateAccessCode();
  await setClientAccessCode(client.id, hashAccessCode(code, portalSessionSecret()), new Date(Date.now() + OTP_TTL_MS));

  const html = renderClientPortalAccessEmail({
    clientName: client.name,
    code,
    expiresIn: '10 minutos',
    portalUrl: `${APP_URL}/portal`,
  });
  const emailResult = await sendEmail(client.email, '🔐 Tu código de acceso al portal — PixelTEC', html);
  if (!emailResult.success) {
    console.error('[client-portal] requestCode: fallo enviando email de OTP', emailResult.error);
    return { success: false, error: 'No se pudo enviar el código. Intenta de nuevo en unos minutos.' };
  }

  return { success: true, data: { message: GENERIC_OTP_MESSAGE } };
}

export async function verifyClientPortalCodeAction(email: string, code: string): Promise<PortalActionResult<null>> {
  const trimmedCode = code.trim().replace(/\D/g, '');
  if (trimmedCode.length !== 6) return { success: false, error: 'El código debe tener 6 dígitos.' };

  const client = await findSinglePortalClientByEmail(email.trim());
  if (!client || !client.portalAccessEnabled) return { success: false, error: 'Código incorrecto.' };

  const codeState = await getClientCodeState(client.id);
  if (!codeState?.accessCodeHash || !accessCodeMatches(codeState.accessCodeHash, trimmedCode, portalSessionSecret())) {
    return { success: false, error: 'Código incorrecto.' };
  }
  if (!codeState.accessCodeExpiresAt || codeState.accessCodeExpiresAt < new Date()) {
    return { success: false, error: 'El código expiró. Solicita uno nuevo.' };
  }

  await clearClientAccessCode(client.id);
  await createPortalSessionCookie(client.publicId);
  return { success: true, data: null };
}

export async function logoutClientPortalAction(): Promise<void> {
  await clearPortalSessionCookie();
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/client-portal/auth-actions.ts
git commit -m "feat(client-portal): server actions públicas — request/verify código, logout"
```

---

### Task 8: Server actions admin (`src/lib/client-portal/admin-actions.ts`)

**Files:**
- Create: `src/lib/client-portal/admin-actions.ts`

**Interfaces:**
- Consumes: `requireOwner`, `resolveClientPgId` (`@/lib/documents/pg`, ya existentes); `listAllClientsForPortalAdmin`, `setPortalAccessEnabled`, `publishPortalUpdate`, `PortalAdminClientRow` (Task 5); `PortalActionResult` (`@/lib/action-types`).
- Produces: `listClientsForPortalAdminAction(): Promise<PortalAdminClientRow[]>`, `setPortalAccessEnabledAction(clientId: string, enabled: boolean): Promise<PortalActionResult<null>>`, `publishPortalUpdateAction(clientId: string, input: { text: string; imageUrl?: string; createdBy: string }): Promise<PortalActionResult<{ id: string }>>` — consumidos por Task 14.

- [ ] **Step 1: Implementación**

Crea `src/lib/client-portal/admin-actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { requireOwner, resolveClientPgId } from '@/lib/documents/pg';
import type { PortalActionResult } from '@/lib/action-types';
import {
  listAllClientsForPortalAdmin,
  setPortalAccessEnabled as setPortalAccessEnabledDb,
  publishPortalUpdate as publishPortalUpdateDb,
  type PortalAdminClientRow,
} from './pg';

export async function listClientsForPortalAdminAction(): Promise<PortalAdminClientRow[]> {
  const { ownerId } = await requireOwner();
  return listAllClientsForPortalAdmin(ownerId);
}

export async function setPortalAccessEnabledAction(clientId: string, enabled: boolean): Promise<PortalActionResult<null>> {
  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return { success: false, error: 'Cliente no encontrado.' };

  const updated = await setPortalAccessEnabledDb(clientPgId, ownerId, enabled);
  if (!updated) return { success: false, error: 'Cliente no encontrado.' };
  return { success: true, data: null };
}

const publishUpdateSchema = z.object({
  text: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional().or(z.literal('')),
  createdBy: z.string().min(1),
});

export async function publishPortalUpdateAction(
  clientId: string,
  input: { text: string; imageUrl?: string; createdBy: string },
): Promise<PortalActionResult<{ id: string }>> {
  const parsed = publishUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos inválidos.' };

  const { ownerId } = await requireOwner();
  const clientPgId = await resolveClientPgId(clientId);
  if (!clientPgId) return { success: false, error: 'Cliente no encontrado.' };

  const id = await publishPortalUpdateDb(clientPgId, ownerId, {
    text: parsed.data.text,
    imageUrl: parsed.data.imageUrl || null,
    createdBy: parsed.data.createdBy,
  });
  if (!id) return { success: false, error: 'Cliente no encontrado.' };
  return { success: true, data: { id } };
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/client-portal/admin-actions.ts
git commit -m "feat(client-portal): server actions admin — listar, activar/desactivar, publicar actualización"
```

---

### Task 9: Extraer generación de PDF de contrato a módulo compartido

**Files:**
- Create: `src/lib/documents/contract-pdf-render.ts`
- Modify: `src/app/api/documents/contract-pdf/route.ts`

**Interfaces:**
- Consumes: `resolveClientPgId` (`@/lib/documents/pg`, ya existente); tabla `clients` (`@/lib/db/schema`).
- Produces: `resolveContractClientName(publicClientId: string): Promise<string>`, `generateContractPdf(contract: Contract & { id: string }, clientName: string): Promise<Buffer>`, `safeContractFilename(title: string, version: number): string` — consumidos por Task 10 y por la ruta admin ya existente (modificada en este task).

- [ ] **Step 1: Crear el módulo compartido**

Crea `src/lib/documents/contract-pdf-render.ts` — es el mismo código que ya vivía inline en `src/app/api/documents/contract-pdf/route.ts` (líneas 1-50 antes de esta tarea), extraído para reusarlo también desde el endpoint del portal (Task 10):

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { resolveClientPgId } from "@/lib/documents/pg";
import type { Contract } from "@/types/documents";

const execFileAsync = promisify(execFile);

// El armado del <Document> (JSX de @react-pdf/renderer) vive en un proceso de
// Node aparte — ver src/lib/documents/pdf-render-worker/render-contract.mjs
// (mismo patrón que proposal-pdf, mismo motivo: React error #31).
const WORKER_PATH = path.join(
  process.cwd(),
  "src/lib/documents/pdf-render-worker/render-contract.mjs",
);

export async function resolveContractClientName(publicClientId: string): Promise<string> {
  const clientPgId = await resolveClientPgId(publicClientId);
  if (!clientPgId) return publicClientId;
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return client?.name ?? publicClientId;
}

export async function generateContractPdf(contract: Contract & { id: string }, clientName: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "contract-pdf-"));
  const inputPath = path.join(dir, "input.json");
  const outputPath = path.join(dir, "output.pdf");
  try {
    await writeFile(inputPath, JSON.stringify({ ...contract, clientName }), "utf-8");
    await execFileAsync(process.execPath, [WORKER_PATH, inputPath, outputPath], {
      cwd: process.cwd(),
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function safeContractFilename(title: string, version: number): string {
  const safeName =
    title
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 100) || "contrato";
  return `${safeName}_v${version}.pdf`;
}
```

- [ ] **Step 2: Reescribir la ruta admin para usar el módulo compartido**

Reemplaza el contenido completo de `src/app/api/documents/contract-pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/vpsClient";
import { findContractByPublicId } from "@/lib/documents/pg";
import { resolveContractClientName, generateContractPdf, safeContractFilename } from "@/lib/documents/contract-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }

    // Auth — session cookie (admin) only.
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);
    if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

    const contract = await findContractByPublicId(contractId);
    if (!contract) {
      return new NextResponse("Contract not found", { status: 404 });
    }
    if (contract.uid !== session.uid) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const clientName = await resolveContractClientName(contract.clientId);
    const pdf = await generateContractPdf(contract, clientName);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeContractFilename(contract.title, contract.version)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Verificación manual — la ruta admin sigue funcionando**

Con el dev server arriba y sesión de staff activa, descarga un contrato firmado existente desde `/clientes/[id]` → tab Contratos → botón de descarga. Confirma que el PDF se genera igual que antes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents/contract-pdf-render.ts src/app/api/documents/contract-pdf/route.ts
git commit -m "refactor(documents): extraer generación de PDF de contrato a módulo compartido"
```

---

### Task 10: Endpoint de descarga de contrato para el portal

**Files:**
- Create: `src/app/api/portal/contract-pdf/route.ts`

**Interfaces:**
- Consumes: `readPortalSessionClientId` (Task 4); `isPortalAccessEnabled` (Task 5); `resolveClientPgId`, `findContractByPublicId` (`@/lib/documents/pg`, ya existentes); `resolveContractClientName`, `generateContractPdf`, `safeContractFilename` (Task 9).

- [ ] **Step 1: Implementación**

Crea `src/app/api/portal/contract-pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { readPortalSessionClientId } from "@/lib/client-portal/cookie";
import { resolveClientPgId, findContractByPublicId } from "@/lib/documents/pg";
import { isPortalAccessEnabled } from "@/lib/client-portal/pg";
import { resolveContractClientName, generateContractPdf, safeContractFilename } from "@/lib/documents/contract-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }

    const publicClientId = await readPortalSessionClientId();
    if (!publicClientId) return new NextResponse("Unauthorized", { status: 401 });

    const clientPgId = await resolveClientPgId(publicClientId);
    if (!clientPgId || !(await isPortalAccessEnabled(clientPgId))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const contract = await findContractByPublicId(contractId);
    if (!contract) return new NextResponse("Contract not found", { status: 404 });

    // Anti-IDOR: el contrato debe pertenecer exactamente al cliente de la
    // sesión Y estar firmado — mismo filtro que ve el dashboard.
    if (contract.clientId !== publicClientId || contract.status !== "firmado") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const clientName = await resolveContractClientName(contract.clientId);
    const pdf = await generateContractPdf(contract, clientName);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeContractFilename(contract.title, contract.version)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[portal-contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portal/contract-pdf/route.ts
git commit -m "feat(client-portal): endpoint de descarga de contrato con sesión de portal"
```

---

### Task 11: Formulario de login (`src/app/portal/portal-login-client.tsx`)

**Files:**
- Create: `src/app/portal/portal-login-client.tsx`

**Interfaces:**
- Consumes: `requestClientPortalCodeAction`, `verifyClientPortalCodeAction` (Task 7).
- Produces: `<PortalLoginClient />` — consumido por Task 13.

- [ ] **Step 1: Implementación**

Crea `src/app/portal/portal-login-client.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { requestClientPortalCodeAction, verifyClientPortalCodeAction } from '@/lib/client-portal/auth-actions';

type Phase = 'idle' | 'sending' | 'code-sent' | 'verifying' | 'error-code';

export function PortalLoginClient() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || phase === 'sending') return;
    setPhase('sending');
    setMessage(null);
    const result = await requestClientPortalCodeAction(email);
    if (result.success) {
      setMessage(result.data.message);
      setPhase('code-sent');
      startCountdown(60);
    } else {
      setMessage(result.error ?? 'No se pudo enviar el código.');
      setPhase('idle');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || phase === 'verifying') return;
    setPhase('verifying');
    setMessage(null);
    const result = await verifyClientPortalCodeAction(email, code);
    if (result.success) {
      window.location.assign('/portal');
      return;
    }
    setMessage(result.error ?? 'No se pudo verificar el código.');
    setCode('');
    setPhase('error-code');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-zinc-950">
      <div className="mb-10 text-center">
        <p className="text-2xl font-bold tracking-tight text-white">
          Pixel<span className="text-cyan-400">TEC</span>
        </p>
        <p className="text-xs text-zinc-600 mt-1 uppercase tracking-[3px]">Portal de Clientes</p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] overflow-hidden shadow-2xl">
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-lime-400" />
        <div className="p-8 sm:p-10">
          {phase === 'idle' || phase === 'sending' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <p className="text-sm text-zinc-500 mb-2">Ingresa tu correo para recibir un código de acceso.</p>
              {message && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {message}
                </div>
              )}
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="email"
                  required
                  autoFocus
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={phase === 'sending'}
                  className="h-12 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
                />
              </div>
              <Button
                type="submit"
                disabled={phase === 'sending'}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl"
              >
                {phase === 'sending' ? (
                  <><Spinner size="sm" className="mr-2" />Enviando código…</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Enviar código por email</>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {message && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                    phase === 'error-code'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                  }`}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {message}
                </div>
              )}
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={phase === 'verifying'}
                className="h-14 w-full rounded-lg border-white/10 bg-black/50 text-center text-2xl tracking-[0.5em] text-white"
              />
              <Button
                type="submit"
                disabled={code.length !== 6 || phase === 'verifying'}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl"
              >
                {phase === 'verifying' ? (
                  <><Spinner size="sm" className="mr-2" />Verificando…</>
                ) : (
                  <><ArrowRight className="mr-2 h-4 w-4" />Ingresar</>
                )}
              </Button>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-zinc-600">
                    Reenviar código en <span className="tabular-nums text-zinc-500">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setPhase('idle'); setCode(''); setMessage(null); }}
                    className="text-xs text-zinc-500 hover:text-cyan-400 flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Solicitar nuevo código
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/portal-login-client.tsx
git commit -m "feat(client-portal): formulario de login por correo + código"
```

---

### Task 12: Dashboard del cliente y botón de logout

**Files:**
- Create: `src/app/portal/portal-dashboard.tsx`
- Create: `src/app/portal/logout-button.tsx`

**Interfaces:**
- Consumes: `PortalDashboardData` (Task 5, tipo); `logoutClientPortalAction` (Task 7).
- Produces: `<PortalDashboard data={PortalDashboardData} />`, `<LogoutButton />` — consumidos por Task 13.

- [ ] **Step 1: Botón de logout**

Crea `src/app/portal/logout-button.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { logoutClientPortalAction } from '@/lib/client-portal/auth-actions';

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await logoutClientPortalAction();
        window.location.assign('/portal');
      }}
      className="border-white/10 text-zinc-400 hover:text-white"
    >
      Cerrar sesión
    </Button>
  );
}
```

- [ ] **Step 2: Dashboard**

Crea `src/app/portal/portal-dashboard.tsx`:

```tsx
import { FolderKanban, FileText, LifeBuoy, FolderArchive, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PortalDashboardData } from '@/lib/client-portal/pg';
import { LogoutButton } from './logout-button';

const statusColors: Record<string, string> = {
  'En desarrollo': 'bg-blue-500/20 text-blue-400',
  'En revisión': 'bg-yellow-500/20 text-yellow-400',
  'Entregado': 'bg-green-500/20 text-green-400',
  'Planeación': 'bg-gray-500/20 text-gray-400',
  'Cancelado': 'bg-red-500/20 text-red-400',
  'Activo': 'bg-cyan-500/20 text-cyan-400',
  'Pagado': 'bg-green-900/50 text-green-400 border-green-500/30',
  'Pendiente': 'bg-yellow-900/50 text-yellow-400 border-yellow-500/30',
  'Abierto': 'bg-red-900/50 text-red-400 border-red-500/30',
  'En proceso': 'bg-cyan-900/50 text-cyan-400 border-cyan-500/30',
  'Esperando cliente': 'bg-orange-900/50 text-orange-400 border-orange-500/30',
  'Resuelto': 'bg-green-900/50 text-green-400 border-green-500/30',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        {icon}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-2 -mr-2">{children}</div>
    </div>
  );
}

export function PortalDashboard({ data }: { data: PortalDashboardData }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Hola, {data.clientName}</h1>
            <p className="text-sm text-zinc-500 mt-1">Resumen de tu cuenta con PixelTEC</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoCard icon={<FolderKanban className="h-6 w-6 text-cyan-400" />} title="Estado de Proyectos">
            {data.projects.length > 0 ? (
              data.projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <p className="font-medium text-zinc-200">{p.name}</p>
                  <Badge variant="outline" className={cn('font-semibold', statusColors[p.status])}>{p.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No hay proyectos activos.</p>
            )}
          </InfoCard>

          <InfoCard icon={<FileText className="h-6 w-6 text-lime-400" />} title="Últimas Facturas">
            {data.invoices.length > 0 ? (
              data.invoices.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="font-medium text-zinc-200">{f.projectName ?? '—'}</p>
                    <p className="text-sm text-zinc-400">{format(new Date(f.date), 'dd MMM, yyyy', { locale: es })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg text-lime-300">{formatCurrency(Number(f.amount))}</p>
                    <Badge variant="outline" className={cn('font-semibold', statusColors[f.status])}>{f.status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No hay registros de facturación.</p>
            )}
          </InfoCard>

          <InfoCard icon={<FolderArchive className="h-6 w-6 text-yellow-400" />} title="Documentos y Contratos">
            {data.contracts.length > 0 ? (
              data.contracts.map((c) => (
                <a
                  key={c.id}
                  href={`/api/portal/contract-pdf?contractId=${c.id}`}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <p className="font-medium text-zinc-200">
                    {c.title} <span className="text-zinc-500 text-xs">v{c.version}</span>
                  </p>
                  <Badge variant="outline" className="font-semibold bg-green-500/20 text-green-400">Firmado</Badge>
                </a>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No hay documentos compartidos.</p>
            )}
          </InfoCard>

          <InfoCard icon={<LifeBuoy className="h-6 w-6 text-red-400" />} title="Tickets de Soporte">
            {data.tickets.length > 0 ? (
              data.tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="max-w-[70%]">
                    <p className="font-medium text-zinc-300 truncate">{t.problema}</p>
                    <p className="text-xs text-zinc-500 font-mono">{t.ticketId}</p>
                  </div>
                  <Badge variant="outline" className={cn('font-semibold', statusColors[t.estado])}>{t.estado}</Badge>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No tienes tickets de soporte.</p>
            )}
          </InfoCard>

          <InfoCard icon={<Megaphone className="h-6 w-6 text-purple-400" />} title="Actualizaciones">
            {data.updates.length > 0 ? (
              data.updates.map((u) => (
                <div key={u.id} className="p-3 bg-white/5 rounded-lg">
                  {u.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.imageUrl} alt="" className="rounded-lg mb-2 w-full object-cover max-h-48" />
                  )}
                  <p className="text-sm text-zinc-200">{u.text}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {u.createdBy} · {format(new Date(u.createdAt), 'dd MMM, yyyy', { locale: es })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">Sin actualizaciones por ahora.</p>
            )}
          </InfoCard>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/portal-dashboard.tsx src/app/portal/logout-button.tsx
git commit -m "feat(client-portal): dashboard del cliente (proyectos, facturas, contratos, tickets, feed)"
```

---

### Task 13: Ruta `/portal` (orquestador)

**Files:**
- Create: `src/app/portal/page.tsx`

**Interfaces:**
- Consumes: `readPortalSessionClientId`, `clearPortalSessionCookie` (Task 4); `resolveClientPgId` (`@/lib/documents/pg`); `getPortalDashboardData` (Task 5); `<PortalLoginClient />` (Task 11); `<PortalDashboard />` (Task 12).

- [ ] **Step 1: Implementación**

Crea `src/app/portal/page.tsx`:

```tsx
import { readPortalSessionClientId, clearPortalSessionCookie } from '@/lib/client-portal/cookie';
import { resolveClientPgId } from '@/lib/documents/pg';
import { getPortalDashboardData } from '@/lib/client-portal/pg';
import { PortalLoginClient } from './portal-login-client';
import { PortalDashboard } from './portal-dashboard';

export default async function PortalPage() {
  const publicClientId = await readPortalSessionClientId();

  if (publicClientId) {
    const clientPgId = await resolveClientPgId(publicClientId);
    const data = clientPgId ? await getPortalDashboardData(clientPgId) : null;
    if (data) return <PortalDashboard data={data} />;

    // Cookie válida pero el cliente ya no existe o el portal fue desactivado
    // — se limpia y se muestra el login, no un error.
    await clearPortalSessionCookie();
  }

  return <PortalLoginClient />;
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Verificación manual básica**

Con el dev server arriba, visita `https://dev.pixeltec.mx/portal` sin sesión — debe mostrar el formulario de correo (no un error 500, no el dashboard).

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/page.tsx
git commit -m "feat(client-portal): ruta /portal — login o dashboard según la sesión"
```

---

### Task 14: Panel admin `/portal-admin`

**Files:**
- Create: `src/components/portal-admin/PortalAdminList.tsx`
- Create: `src/app/(admin)/portal-admin/page.tsx`

**Interfaces:**
- Consumes: `listClientsForPortalAdminAction`, `setPortalAccessEnabledAction`, `publishPortalUpdateAction` (Task 8); `useUser` (`@/hooks/use-user`, ya existente).

- [ ] **Step 1: Componente de lista admin**

Crea `src/components/portal-admin/PortalAdminList.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useUser } from '@/hooks/use-user';
import {
  listClientsForPortalAdminAction,
  setPortalAccessEnabledAction,
  publishPortalUpdateAction,
} from '@/lib/client-portal/admin-actions';
import type { PortalAdminClientRow } from '@/lib/client-portal/pg';

export function PortalAdminList() {
  const user = useUser();
  const [clients, setClients] = useState<PortalAdminClientRow[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [updateImageUrl, setUpdateImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listClientsForPortalAdminAction();
    setClients(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (clientId: string, enabled: boolean) => {
    setTogglingId(clientId);
    const result = await setPortalAccessEnabledAction(clientId, enabled);
    if (result.success) {
      setClients((prev) => prev?.map((c) => (c.id === clientId ? { ...c, portalAccessEnabled: enabled } : c)) ?? null);
    }
    setTogglingId(null);
  };

  const handlePublish = async (clientId: string) => {
    if (!updateText.trim() || !user) return;
    setPublishing(true);
    const result = await publishPortalUpdateAction(clientId, {
      text: updateText.trim(),
      imageUrl: updateImageUrl.trim() || undefined,
      createdBy: user.displayName ?? user.email ?? 'Equipo PixelTEC',
    });
    setPublishing(false);
    if (result.success) {
      setUpdateText('');
      setUpdateImageUrl('');
      setExpandedId(null);
      setPublishedId(clientId);
      setTimeout(() => setPublishedId(null), 3000);
    }
  };

  if (!clients) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <div key={client.id} className="rounded-lg border border-zinc-700/30 bg-zinc-800/20">
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{client.name}</p>
              <p className="text-xs text-zinc-500 truncate">{client.email ?? 'Sin correo'}</p>
            </div>

            {publishedId === client.id && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <Check className="h-3.5 w-3.5" />
                Publicado
              </span>
            )}

            <button
              type="button"
              onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
              disabled={!client.portalAccessEnabled}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Publicar actualización
            </button>

            <div className="flex items-center gap-2">
              {togglingId === client.id && <Spinner size="sm" />}
              <Switch
                checked={client.portalAccessEnabled}
                disabled={togglingId === client.id}
                onCheckedChange={(checked) => handleToggle(client.id, checked)}
                aria-label={`Portal ${client.portalAccessEnabled ? 'activo' : 'inactivo'} para ${client.name}`}
              />
            </div>
          </div>

          {expandedId === client.id && (
            <div className="border-t border-zinc-700/30 p-4 space-y-2">
              <Textarea
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Novedad para el cliente…"
                rows={3}
                className="bg-zinc-900/60 border-zinc-700/50 text-sm text-zinc-100"
              />
              <Input
                type="url"
                value={updateImageUrl}
                onChange={(e) => setUpdateImageUrl(e.target.value)}
                placeholder="URL de imagen (opcional)"
                className="bg-zinc-900/60 border-zinc-700/50 text-sm text-zinc-100"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setExpandedId(null); setUpdateText(''); setUpdateImageUrl(''); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish(client.id)}
                  disabled={publishing || !updateText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 disabled:opacity-50"
                >
                  {publishing ? <Spinner size="sm" /> : <Check className="h-3.5 w-3.5" />}
                  Publicar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Página**

Crea `src/app/(admin)/portal-admin/page.tsx`:

```tsx
import { PortalAdminList } from '@/components/portal-admin/PortalAdminList';

export default function PortalAdminPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Portal de Clientes</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Activa el acceso al portal por cliente y publica actualizaciones. Todos los clientes, sin importar su origen.
        </p>
      </div>
      <PortalAdminList />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/portal-admin/PortalAdminList.tsx "src/app/(admin)/portal-admin/page.tsx"
git commit -m "feat(client-portal): panel admin /portal-admin — activar acceso y publicar actualizaciones"
```

---

### Task 15: Registrar la ruta y el nav

**Files:**
- Modify: `src/lib/routes/admin-routes.ts`
- Modify: `src/components/nav/nav-config.ts`
- Modify: `src/components/nav/command-palette-items.ts`

**Interfaces:**
- Ninguna nueva — conecta `/portal-admin` (Task 14) al middleware de auth y a la navegación existente.

- [ ] **Step 1: Proteger la ruta con sesión**

En `src/lib/routes/admin-routes.ts`, agrega `'portal-admin'` a `ADMIN_ROUTES`:

```ts
export const ADMIN_ROUTES = [
  'hoy',
  'tareas',
  'proyectos',
  'clientes',
  'whatsapp',
  'cobros',
  'accesos',
  'vps',
  'crypto-intel',
  'perfil',
  'notificaciones',
  'blog-admin',
  'crecimiento',
  'documentos',
  'ia-factory',
  'portal-admin',
] as const;
```

- [ ] **Step 2: Agregar al sidebar/nav**

En `src/components/nav/nav-config.ts`, en el área `crm`, agrega la entrada (después de `/whatsapp`):

```ts
  crm: [
    { href: "/clientes" },
    { href: "/whatsapp" },
    { href: "/portal-admin", secondaryLabel: "Portal — acceso" },
  ],
```

- [ ] **Step 3: Agregar al command palette**

En `src/components/nav/command-palette-items.ts`, en la sección `"sistema"` (junto a `/perfil`), agrega:

```ts
  {
    href: "/portal-admin",
    label: "Portal de clientes",
    description: "Activa el acceso al portal por cliente y publica actualizaciones",
    icon: KeyRound,
    section: "sistema",
  },
```

(`KeyRound` ya está importado en ese archivo — se usa también para `/accesos`.)

- [ ] **Step 4: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 5: Verificación manual**

Con sesión de staff activa en `dev.pixeltec.mx`, confirma que `/portal-admin` aparece en el sidebar (área CRM) y en el command palette (⌘K, buscar "portal"), y que navegar ahí sin sesión redirige a `/login`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routes/admin-routes.ts src/components/nav/nav-config.ts src/components/nav/command-palette-items.ts
git commit -m "feat(client-portal): registrar /portal-admin en rutas protegidas y navegación"
```

---

### Task 16: Verificación end-to-end

**Files:** Ninguno — solo verificación manual/curl contra `dev.pixeltec.mx`, sin tocar código.

- [ ] **Step 1: Typecheck y lint finales**

Run: `node_modules/.bin/tsc --noEmit && npm run lint`
Expected: 0 errores en ambos (lint puede mostrar los mismos warnings preexistentes no relacionados con este trabajo — no debe haber errores nuevos en archivos tocados por este plan).

Run: `npx vitest run`
Expected: todos los tests pasan, incluidos los 12 nuevos de `otp.test.ts` y `session-token.test.ts`.

- [ ] **Step 2: Crear un cliente de prueba con portal activo**

Con sesión de staff, ve a `/portal-admin`, activa el interruptor de un cliente de prueba (crear uno temporal si no hay ninguno con correo controlado por ti — bórralo al final de esta tarea).

- [ ] **Step 3: Flujo de login exitoso**

Ve a `https://dev.pixeltec.mx/portal`, mete el correo del cliente de prueba, confirma que llega el código por email, escríbelo, y confirma que entras al dashboard con datos reales (proyectos/facturas/contratos/tickets/feed, cada uno con su estado vacío si no hay datos).

- [ ] **Step 4: Portal desactivado**

Con un cliente cuyo `portalAccessEnabled` esté en `false`, solicita el código — confirma que ves el mensaje genérico y que **no** llega ningún correo real.

- [ ] **Step 5: Correo duplicado**

Crea temporalmente dos clientes de prueba con el mismo correo. Solicita/verifica el código con ese correo — confirma que se rechaza (mensaje genérico al solicitar, "Código incorrecto." al intentar verificar cualquier código). Borra estos clientes de prueba al terminar.

- [ ] **Step 6: Código incorrecto y expirado**

Solicita un código válido, escribe uno incorrecto — confirma "Código incorrecto.". Espera a que expire (o ajusta manualmente `accessCodeExpiresAt` en la base a una fecha pasada) y verifica que da "El código expiró. Solicita uno nuevo.".

- [ ] **Step 7: Descarga de contrato — propio vs. ajeno**

Con sesión de portal activa de un cliente con al menos un contrato firmado, descarga su PDF desde el dashboard — confirma que se genera correctamente. Después, con la misma sesión, intenta `GET /api/portal/contract-pdf?contractId=<id-de-un-contrato-de-otro-cliente>` — confirma `403 Forbidden`.

- [ ] **Step 8: Revocación en caliente**

Con la sesión del cliente de prueba todavía abierta en el navegador, desactiva su portal desde `/portal-admin`. Recarga `/portal` en la sesión del cliente — confirma que te regresa al formulario de login (no un error), y que la cookie fue limpiada (inspecciona en devtools que `__client_portal_session` ya no está, o que una nueva carga no reutiliza sesión).

- [ ] **Step 9: Publicar actualización**

Desde `/portal-admin`, publica una actualización (texto + imagen opcional) para el cliente de prueba. Recarga `/portal` con sesión de ese cliente — confirma que aparece en la tarjeta "Actualizaciones".

- [ ] **Step 10: Logout**

Desde el dashboard del cliente, haz clic en "Cerrar sesión" — confirma que regresa al formulario de login y que recargar `/portal` no reingresa automáticamente.

- [ ] **Step 11: `/portal-admin` lista todos los clientes**

Confirma visualmente que `/portal-admin` muestra más clientes que `/clientes` (los 13 reales vs. los 3 `crm_blob` que aparecen en el CRM) — esto confirma que el filtro `source='crm_blob'` de `useCRM()` no está afectando este panel.

- [ ] **Step 12: Limpieza**

Borra cualquier cliente de prueba creado durante esta verificación. Confirma con `git status` que no quedan cambios sin commitear fuera de lo esperado.

- [ ] **Step 13: Actualizar `pixeltecpend.md`**

Agrega una entrada de sesión nueva documentando que el Portal de Clientes v2 quedó implementado y verificado en dev, HEAD actual, sin deploy a producción — pendiente de que Miguel lo pida explícitamente. Sigue el formato de las sesiones anteriores en ese archivo.

```bash
git add pixeltecpend.md
git commit -m "docs: cerrar sesión — Portal de Clientes v2 implementado y verificado en dev"
```

---

## Nota final

Ningún paso de este plan incluye deploy a producción. Verificación exclusivamente en `dev.pixeltec.mx` con clientes de prueba creados y borrados en la misma sesión — el deploy requiere autorización explícita de Miguel, como en el resto del proyecto.
