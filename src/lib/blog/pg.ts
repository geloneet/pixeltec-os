// Helpers compartidos de la capa Postgres del blog (Fase 4).
//
// Los ids públicos que circulan en la UI/rutas son los ids originales de
// Firestore para los posts migrados y uuids de Postgres para los nuevos —
// estas funciones resuelven ambos.
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts, blogBriefs, users } from '@/lib/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolvePostRow(postId: string) {
  const [byFs] = await db.select().from(blogPosts).where(eq(blogPosts.firestoreId, postId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(postId)) return null;
  const [byId] = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
  return byId ?? null;
}

export async function resolveBriefRow(briefId: string) {
  const [byFs] = await db.select().from(blogBriefs).where(eq(blogBriefs.firestoreId, briefId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(briefId)) return null;
  const [byId] = await db.select().from(blogBriefs).where(eq(blogBriefs.id, briefId)).limit(1);
  return byId ?? null;
}

/** Public id: prefer the original Firestore id for migrated rows. */
export function publicId(row: { id: string; firestoreId: string | null }): string {
  return row.firestoreId ?? row.id;
}

/** Display name del usuario (antes: getAdminAuth().getUser(uid).displayName). */
export async function getUserDisplayName(firebaseUid: string): Promise<string> {
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
  return u?.name ?? 'Admin';
}
