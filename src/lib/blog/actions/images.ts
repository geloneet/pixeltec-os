'use server';

import { requireUserSession } from '@/lib/auth/session';
import { searchUnsplashPhotos, type UnsplashPhoto } from '@/lib/unsplash-egress';
import { toPublicFailure } from '@/lib/errors/public-failure';
import type { ActionResult } from '../schemas';

/** Búsqueda de portadas en Unsplash para el editor del blog. Canal de egress
 *  opcional: si no está configurado, el error saneado se lo dice al editor. */
export async function searchCoverImages(query: string, page = 1): Promise<ActionResult<UnsplashPhoto[]>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };

  const q = query?.trim() ?? '';
  if (q.length < 2 || q.length > 100) {
    return { ok: false, error: 'Escribe una búsqueda de 2 a 100 caracteres.' };
  }

  try {
    const photos = await searchUnsplashPhotos(q, page);
    return { ok: true, data: photos };
  } catch (err) {
    console.error('searchCoverImages error:', err);
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'unsplash_not_configured' || msg.includes('EGRESS_BLOCKED')) {
      return {
        ok: false,
        error: 'Búsqueda de Unsplash no configurada: agrega UNSPLASH_ACCESS_KEY y EGRESS_UNSPLASH_MODE=live en el servidor.',
      };
    }
    return {
      ok: false,
      error: toPublicFailure(err, {
        code: 'unsplash_search_failed',
        message: 'Error buscando imágenes',
      }).message,
    };
  }
}
