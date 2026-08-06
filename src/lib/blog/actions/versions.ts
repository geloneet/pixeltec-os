'use server';

// B-PR6 — Server Actions del versionado de artículos. Resuelven ids públicos
// (firestore legacy o uuid) y delegan en la capa pura de src/lib/blog/versions.
import { db } from '@/lib/db';
import { requireUserSession } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth-guards';
import { resolvePostRow, getUserDisplayName } from '../pg';
import { getVersion, restoreVersion, snapshotPost } from '../versions';
import type { ActionResult } from '../schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';

export interface PostVersionContent {
  version: number;
  reason: string;
  title: string;
  excerpt: string;
  body: string;
  createdByName: string;
  createdAt: string;
}

/** Contenido completo de una versión — para el visor de diff del editor. */
export async function getPostVersionContent(
  postId: string,
  versionId: string
): Promise<ActionResult<PostVersionContent>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  try {
    const version = await getVersion(versionId);
    if (!version || version.postId !== row.id) {
      return { ok: false, error: 'Versión no encontrada' };
    }
    return {
      ok: true,
      data: {
        version: version.version,
        reason: version.reason,
        title: version.title,
        excerpt: version.excerpt,
        body: version.body,
        createdByName: version.createdByName,
        createdAt: version.createdAt.toISOString(),
      },
    };
  } catch (err) {
    console.error('getPostVersionContent error:', err);
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'blog_version_read_failed',
        message: 'No se pudo leer la versión',
      }).message,
    };
  }
}

/** Restaura una versión (con snapshot previo `pre-restauracion` automático).
 *  Nunca toca status ni slug — misma exigencia de sesión que editar. */
export async function restorePostVersion(
  postId: string,
  versionId: string
): Promise<ActionResult<{ restoredVersion: number }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };

  try {
    const actorName = await getUserDisplayName(session.userId);
    const result = await restoreVersion(row.id, versionId, {
      id: session.userId,
      name: actorName,
    });
    return { ok: true, data: result };
  } catch (err) {
    console.error('restorePostVersion error:', err);
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'blog_version_restore_failed',
        message: 'No se pudo restaurar la versión',
      }).message,
    };
  }
}

/**
 * «Crear nueva revisión» sobre un artículo PUBLICADO: congela lo publicado
 * como versión `nueva-revision` y la edición continúa in situ (el post no
 * cambia de estado ni se duplica). Admin-only: es una operación sobre
 * contenido público.
 */
export async function createRevision(
  postId: string
): Promise<ActionResult<{ version: number }>> {
  const guard = await requireAdmin(undefined, { route: 'blog:create-revision' });
  if (!guard.ok) return { ok: false, error: guard.error };

  const row = await resolvePostRow(postId);
  if (!row) return { ok: false, error: 'Post no encontrado' };
  if (row.status !== 'published') {
    return { ok: false, error: 'Solo un artículo publicado admite nueva revisión.' };
  }

  try {
    const actorName = await getUserDisplayName(guard.uid);
    const version = await snapshotPost(db, row, 'nueva-revision', {
      id: guard.uid,
      name: actorName,
    });
    return { ok: true, data: { version } };
  } catch (err) {
    console.error('createRevision error:', err);
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'blog_create_revision_failed',
        message: 'No se pudo crear la revisión',
      }).message,
    };
  }
}
