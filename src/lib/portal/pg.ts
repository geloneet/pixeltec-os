// Helpers Postgres del portal OTP (Fase 4) — antes colección top-level
// `clients` de Firestore (+ subcolecciones updates/projects).
//
// Los clientId públicos que viajan en la sesión de portal son los ids
// originales de Firestore para filas migradas (columna firestore_id) y
// uuids para filas nuevas — resolver ambos.
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PortalClientRow = typeof clients.$inferSelect;

export async function findPortalClientBySlug(slug: string): Promise<PortalClientRow | null> {
  const [row] = await db.select().from(clients).where(eq(clients.slug, slug.trim())).limit(1);
  return row ?? null;
}

export async function resolvePortalClient(clientId: string): Promise<PortalClientRow | null> {
  const [byFs] = await db.select().from(clients).where(eq(clients.firestoreId, clientId.trim())).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(clientId.trim())) return null;
  const [byId] = await db.select().from(clients).where(eq(clients.id, clientId.trim())).limit(1);
  return byId ?? null;
}

/** Id público estable del cliente (prefiere el id original de Firestore). */
export function portalClientPublicId(row: PortalClientRow): string {
  return row.firestoreId ?? row.id;
}
