// Helpers compartidos de la capa Postgres del Growth Suite (Fase 4).
//
// Los ids públicos que circulan en la UI/rutas son los ids originales de
// Firestore para las filas migradas y uuids de Postgres para las nuevas —
// estas funciones resuelven ambos (mismo patrón que src/lib/blog/pg.ts).
//
// `getSessionUid()` devuelve el UID de Firebase (valor puente); las tablas
// growth* usan `ownerId` = users.id (uuid de Postgres). `resolveOwnerId`
// hace ese mapeo vía la columna users.firebase_uid.
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users,
  growthBrands,
  growthPosts,
  growthCampaigns,
  growthJobs,
  growthSocialAccounts,
} from '@/lib/db/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Firebase UID (sesión) → users.id (uuid de Postgres). */
export async function resolveOwnerId(firebaseUid: string): Promise<string | null> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return u?.id ?? null;
}

export async function resolveBrandRow(brandId: string) {
  const [byFs] = await db.select().from(growthBrands).where(eq(growthBrands.firestoreId, brandId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(brandId)) return null;
  const [byId] = await db.select().from(growthBrands).where(eq(growthBrands.id, brandId)).limit(1);
  return byId ?? null;
}

export async function resolvePostRow(postId: string) {
  const [byFs] = await db.select().from(growthPosts).where(eq(growthPosts.firestoreId, postId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(postId)) return null;
  const [byId] = await db.select().from(growthPosts).where(eq(growthPosts.id, postId)).limit(1);
  return byId ?? null;
}

export async function resolveCampaignRow(campaignId: string) {
  const [byFs] = await db
    .select()
    .from(growthCampaigns)
    .where(eq(growthCampaigns.firestoreId, campaignId))
    .limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(campaignId)) return null;
  const [byId] = await db.select().from(growthCampaigns).where(eq(growthCampaigns.id, campaignId)).limit(1);
  return byId ?? null;
}

export async function resolveJobRow(jobId: string) {
  const [byFs] = await db.select().from(growthJobs).where(eq(growthJobs.firestoreId, jobId)).limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(jobId)) return null;
  const [byId] = await db.select().from(growthJobs).where(eq(growthJobs.id, jobId)).limit(1);
  return byId ?? null;
}

export async function resolveSocialAccountRow(accountId: string) {
  const [byFs] = await db
    .select()
    .from(growthSocialAccounts)
    .where(eq(growthSocialAccounts.firestoreId, accountId))
    .limit(1);
  if (byFs) return byFs;
  if (!UUID_RE.test(accountId)) return null;
  const [byId] = await db
    .select()
    .from(growthSocialAccounts)
    .where(eq(growthSocialAccounts.id, accountId))
    .limit(1);
  return byId ?? null;
}

/** Public id: prefer the original Firestore id for migrated rows. */
export function publicId(row: { id: string; firestoreId: string | null }): string {
  return row.firestoreId ?? row.id;
}

type GrowthPostRow = typeof growthPosts.$inferSelect;
type GrowthCampaignRow = typeof growthCampaigns.$inferSelect;

/**
 * Serializa una fila de growth_posts al JSON que las rutas API devolvían con
 * Firestore: `{ id, ...data }` con timestamps como ISO strings (o null).
 */
export function serializePostRow(row: GrowthPostRow): Record<string, unknown> {
  const { id: _id, firestoreId: _fs, ownerId, ...rest } = row;
  return {
    id: publicId(row),
    uid: ownerId,
    ...rest,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

/**
 * Serializa una fila de growth_campaigns reconstruyendo el shape del
 * documento Firestore (`counters` anidado, `dateRange` opcional).
 */
export function serializeCampaignRow(row: GrowthCampaignRow): Record<string, unknown> {
  return {
    id: publicId(row),
    uid: row.ownerId,
    brandId: row.brandId,
    name: row.name,
    objective: row.objective,
    targetAction: row.targetAction,
    targetPlatforms: row.targetPlatforms,
    status: row.status,
    strategy: row.strategy ?? undefined,
    counters: {
      totalPosts: row.totalPosts,
      generatedPosts: row.generatedPosts,
      approvedPosts: row.approvedPosts,
      publishedPosts: row.publishedPosts,
    },
    dateRange:
      row.startDate && row.endDate
        ? { startDate: row.startDate, endDate: row.endDate }
        : undefined,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}
