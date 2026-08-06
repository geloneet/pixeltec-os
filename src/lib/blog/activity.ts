import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogActivity } from '@/lib/db/schema';

/**
 * Historial editorial del blog (D5 del plan 2026-08-05, espejo de
 * client-activity): vocabulario cerrado en TS sobre una columna text —
 * extensible sin migración. El writer es FIRE-SAFE: un fallo del historial
 * jamás tumba la operación editorial que lo origina (y la tabla puede no
 * existir aún en la base cuando el código llega antes que la migración).
 */
export type BlogActivityType =
  | 'creado'
  | 'generado-ia'
  | 'editado'
  | 'enviado-a-revision'
  | 'devuelto'
  | 'aprobado'
  | 'publicado'
  | 'archivado'
  | 'restaurado-archivo'
  | 'slug-cambiado'
  | 'regenerado-ia'
  | 'version-restaurada'
  | 'advertencias-aceptadas';

export interface BlogActivityInput {
  postId: string;
  type: BlogActivityType;
  message: string;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface BlogActivityEntry {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAt: string;
}

/** Ventana del debounce lógico de `editado`: el autosave corre cada 5 s y un
 *  evento por guardado sería ruido, no historial. */
export const EDIT_LOG_DEBOUNCE_MS = 30 * 60_000;

export async function logBlogActivity(input: BlogActivityInput): Promise<void> {
  try {
    if (input.type === 'editado') {
      const [last] = await db
        .select({ createdAt: blogActivity.createdAt })
        .from(blogActivity)
        .where(
          and(
            eq(blogActivity.postId, input.postId),
            eq(blogActivity.type, 'editado'),
            ...(input.actorId ? [eq(blogActivity.actorId, input.actorId)] : [])
          )
        )
        .orderBy(desc(blogActivity.createdAt))
        .limit(1);
      if (last && Date.now() - last.createdAt.getTime() < EDIT_LOG_DEBOUNCE_MS) return;
    }

    await db.insert(blogActivity).values({
      postId: input.postId,
      type: input.type,
      message: input.message,
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.error('[blog-activity] no se pudo registrar (no bloquea):', err);
  }
}

export async function getBlogActivityRows(postId: string, limit = 30): Promise<BlogActivityEntry[]> {
  const rows = await db
    .select({
      id: blogActivity.id,
      type: blogActivity.type,
      message: blogActivity.message,
      actorName: blogActivity.actorName,
      createdAt: blogActivity.createdAt,
    })
    .from(blogActivity)
    .where(eq(blogActivity.postId, postId))
    .orderBy(desc(blogActivity.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
