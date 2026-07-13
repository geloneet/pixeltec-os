import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, projects, contracts, finances, tickets, clientPortalUpdates, users } from "@/lib/db/schema";
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
  const [client] = await db
    .select({ name: clients.name, portalAccessEnabled: clients.portalAccessEnabled })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  if (!client || !client.portalAccessEnabled) return null;

  // finances/tickets se matchean por nombre (deuda heredada, ver comentario
  // abajo). Si el nombre está duplicado en `clients`, ese match mezclaría los
  // datos de otro cliente — fail-safe: se omiten ambas secciones antes que
  // fugar información. `portalLoginBlockerFor` bloquea activar el portal en
  // este estado; este guard cubre duplicados creados después de activar.
  const sameName = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.name, client.name))
    .limit(2);
  const nameIsUnique = sameName.length === 1;
  if (!nameIsUnique) {
    console.warn(
      `[client-portal] nombre duplicado en clients ("${client.name}") — facturas y tickets omitidos del dashboard`,
    );
  }

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
    nameIsUnique
      ? db
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
          .limit(20)
      : [],
    nameIsUnique
      ? db
          .select({ id: tickets.id, ticketId: tickets.ticketId, problema: tickets.problema, estado: tickets.estado })
          .from(tickets)
          .where(eq(tickets.cliente, client.name))
          .orderBy(desc(tickets.createdAt))
          .limit(20)
      : [],
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


/**
 * Verifica que el portal puede operar con seguridad para este cliente. Devuelve
 * un mensaje de error si:
 * - su correo falta o lo comparten ≥2 registros — `findSinglePortalClientByEmail`
 *   devolvería `null` y el cliente nunca recibiría un código (lockout silencioso);
 * - su nombre lo comparten ≥2 registros — facturas y tickets se matchean por
 *   nombre (deuda heredada) y el dashboard mostraría datos del otro cliente.
 * Devuelve `null` si todo está bien.
 */
export async function portalLoginBlockerFor(clientPgId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: clients.email, name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  const email = row?.email?.trim().toLowerCase();
  if (!row || !email) return "Este cliente no tiene correo; el portal no podrá enviarle un código de acceso.";
  const dupes = await db.select({ id: clients.id }).from(clients).where(sql`lower(${clients.email}) = ${email}`);
  if (dupes.length > 1)
    return "Este cliente comparte correo con otro registro; corrige el duplicado antes de activar el portal (el login por código no podría identificarlo).";
  const nameDupes = await db.select({ id: clients.id }).from(clients).where(eq(clients.name, row.name)).limit(2);
  if (nameDupes.length > 1)
    return "Este cliente comparte nombre con otro registro; el portal no podría aislar sus facturas y tickets (se matchean por nombre). Corrige el duplicado antes de activar.";
  return null;
}

/**
 * Estado de portal de un cliente puntual — owner-scoped. Usado por la pestaña
 * Portal en la ficha del cliente. Capa de datos independiente, nunca pasa
 * por `crm-sync.ts`, así que el toggle no puede pisarse con un `persist()`
 * viejo del browser. Devuelve `null` si `clientPgId` no existe o no es de
 * `ownerId`.
 */
export async function getPortalStatusForClient(
  clientPgId: string,
  ownerId: string,
): Promise<{ portalAccessEnabled: boolean; email: string | null } | null> {
  const [row] = await db
    .select({ portalAccessEnabled: clients.portalAccessEnabled, email: clients.email })
    .from(clients)
    .where(and(eq(clients.id, clientPgId), eq(clients.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
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

/**
 * Devuelve el id de la actualización creada, o `null` si `clientPgId` no
 * pertenece a `ownerId`. La autoría (`createdBy`) se deriva del registro del
 * owner autenticado — nunca se acepta del caller, para que el nombre mostrado
 * al cliente no sea spoofeable.
 */
export async function publishPortalUpdate(
  clientPgId: string,
  ownerId: string,
  update: { text: string; imageUrl: string | null },
): Promise<string | null> {
  const [owned] = await db
    .select({ ownerName: users.name, ownerEmail: users.email })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.ownerId))
    .where(and(eq(clients.id, clientPgId), eq(clients.ownerId, ownerId)))
    .limit(1);
  if (!owned) return null;

  const [inserted] = await db
    .insert(clientPortalUpdates)
    .values({
      clientId: clientPgId,
      text: update.text,
      imageUrl: update.imageUrl,
      createdBy: owned.ownerName || owned.ownerEmail || "Equipo PixelTEC",
    })
    .returning({ id: clientPortalUpdates.id });
  return inserted.id;
}
