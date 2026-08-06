/**
 * Versionado de artículos del blog (B-PR6): snapshots inmutables del contenido
 * en los momentos de riesgo — antes de regenerar con IA, al publicar, al abrir
 * una nueva revisión y antes de restaurar.
 *
 * Patrón calcado de pixelforgePageVersions: `version` es incremental por post,
 * calculado max+1 DENTRO de la misma transacción que el insert; el unique
 * index (post_id, version) es la red de seguridad ante una carrera.
 *
 * Regla dura de `restoreVersion`: restaura CONTENIDO, jamás `status` (el flujo
 * editorial no viaja en el tiempo) ni `slug` (las URLs públicas no cambian por
 * una restauración).
 */
import { desc, eq, sql } from 'drizzle-orm';
import { db, type DB } from '@/lib/db';
import { blogPosts, blogPostVersions } from '@/lib/db/schema';
import { logBlogActivity } from './activity';
import { computeWordCount, computeReadingTime } from './ai/generate-post';

type PostRow = typeof blogPosts.$inferSelect;
export type BlogPostVersionRow = typeof blogPostVersions.$inferSelect;

/** El ejecutor puede ser `db` o la `tx` de una transacción ya abierta. */
export type DbExecutor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export type SnapshotReason =
  | 'pre-regeneracion-ia'
  | 'publicacion'
  | 'nueva-revision'
  | 'pre-restauracion'
  | 'manual';

export interface SnapshotActor {
  id: string | null;
  name: string;
}

/**
 * Congela el contenido actual de `row` como la siguiente versión del post.
 * `version = max+1` se calcula sobre el MISMO ejecutor (tx) que hace el
 * insert; devuelve el número de versión creado.
 */
export async function snapshotPost(
  dbx: DbExecutor,
  row: PostRow,
  reason: SnapshotReason,
  actor: SnapshotActor
): Promise<number> {
  const [agg] = await dbx
    .select({ max: sql<number | null>`max(${blogPostVersions.version})` })
    .from(blogPostVersions)
    .where(eq(blogPostVersions.postId, row.id));
  const version = (agg?.max != null ? Number(agg.max) : 0) + 1;

  await dbx.insert(blogPostVersions).values({
    postId: row.id,
    version,
    reason,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    slug: row.slug,
    category: row.category,
    tags: row.tags ?? [],
    coverImage: row.coverImage,
    seo: row.seo ?? {},
    editorial: row.editorial ?? {},
    sources: row.sources ?? [],
    internalLinks: row.internalLinks ?? [],
    ai: row.ai ?? {},
    createdById: actor.id,
    createdByName: actor.name,
  });

  return version;
}

/** Metadatos de una versión para el listado — SIN body (solo longitudes):
 *  la card del editor no necesita cargar cuerpos completos. */
export interface BlogPostVersionMeta {
  id: string;
  version: number;
  reason: string;
  title: string;
  bodyLength: number;
  excerptLength: number;
  createdByName: string;
  createdAt: string;
}

export async function listVersions(postId: string): Promise<BlogPostVersionMeta[]> {
  const rows = await db
    .select({
      id: blogPostVersions.id,
      version: blogPostVersions.version,
      reason: blogPostVersions.reason,
      title: blogPostVersions.title,
      bodyLength: sql<number>`length(${blogPostVersions.body})`,
      excerptLength: sql<number>`length(${blogPostVersions.excerpt})`,
      createdByName: blogPostVersions.createdByName,
      createdAt: blogPostVersions.createdAt,
    })
    .from(blogPostVersions)
    .where(eq(blogPostVersions.postId, postId))
    .orderBy(desc(blogPostVersions.version));
  return rows.map((r) => ({
    ...r,
    version: Number(r.version),
    bodyLength: Number(r.bodyLength),
    excerptLength: Number(r.excerptLength),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getVersion(versionId: string): Promise<BlogPostVersionRow | null> {
  const [row] = await db
    .select()
    .from(blogPostVersions)
    .where(eq(blogPostVersions.id, versionId))
    .limit(1);
  return row ?? null;
}

/**
 * Restaura el contenido de una versión sobre el post. Antes de pisar nada,
 * congela el estado actual como snapshot `pre-restauracion` (restaurar siempre
 * es reversible). NUNCA toca `status` ni `slug`.
 *
 * `postId` es el uuid REAL de blog_posts — la Server Action resuelve los ids
 * públicos legacy (firestore) antes de llegar aquí.
 */
export async function restoreVersion(
  postId: string,
  versionId: string,
  actor: SnapshotActor
): Promise<{ restoredVersion: number }> {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, postId)).limit(1);
  if (!row) throw new Error('Post no encontrado');

  const version = await getVersion(versionId);
  if (!version || version.postId !== row.id) throw new Error('Versión no encontrada');

  await db.transaction(async (tx) => {
    await snapshotPost(tx, row, 'pre-restauracion', actor);
    await tx
      .update(blogPosts)
      .set({
        title: version.title,
        excerpt: version.excerpt,
        body: version.body,
        category: version.category,
        tags: version.tags ?? [],
        coverImage: version.coverImage,
        seo: version.seo ?? {},
        sources: version.sources ?? [],
        internalLinks: version.internalLinks ?? [],
        // Derivados del body restaurado (no son «contenido»: se recalculan
        // para que el listado no muestre cifras del cuerpo anterior).
        wordCount: computeWordCount(version.body),
        readingTimeMin: computeReadingTime(computeWordCount(version.body)),
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, row.id));
  });

  await logBlogActivity({
    postId: row.id,
    type: 'version-restaurada',
    message: `Versión ${version.version} restaurada («${version.title}»)`,
    actorId: actor.id,
    actorName: actor.name,
    metadata: { versionId: version.id, version: version.version },
  });

  return { restoredVersion: version.version };
}
