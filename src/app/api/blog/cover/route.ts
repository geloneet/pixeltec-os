import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/auth-guards';
import { getUserDisplayName, resolvePostRow } from '@/lib/blog/pg';
import { logBlogActivity } from '@/lib/blog/activity';
import { deleteObject, uploadObject } from '@/lib/r2/upload';

/**
 * Subida de portada del blog a R2 (B-PR5). Mismo patrón que
 * /api/growth/brands/logo, con dos endurecimientos: sin SVG (la portada se
 * sirve en <img> público y SVG permite scripting) y verificación de magic
 * bytes — el MIME declarado por el cliente no basta.
 */

const MAX_BYTES = 5 * 1024 * 1024;

/** MIME permitido → extensión de la key en R2. */
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Comprobación mínima local de magic bytes (deliberadamente duplicada del
 *  helper de avatares de otra rama para no acoplar PRs): JPEG FF D8 FF,
 *  PNG 89 50 4E 47, WebP RIFF….WEBP. */
function magicBytesMatch(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

/** Si la portada actual ya vive en R2 bajo blog/covers/, extrae su key para
 *  borrar el objeto anterior (una URL externa — Unsplash — no se toca). */
function coverKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const idx = url.indexOf('blog/covers/');
  return idx >= 0 ? url.slice(idx) : null;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(undefined, { route: 'blog:cover-upload' });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const postId = (form.get('postId') as string | null) ?? '';

  if (!file || !postId) {
    return NextResponse.json({ error: 'Faltan postId o file' }, { status: 400 });
  }
  const ext = ALLOWED_EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido (jpeg, png o webp)' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo mayor a 5MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!magicBytesMatch(buffer, file.type)) {
    return NextResponse.json(
      { error: 'El contenido del archivo no coincide con el tipo declarado' },
      { status: 400 }
    );
  }

  const row = await resolvePostRow(postId);
  if (!row) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });

  // Key con hash del contenido: re-subir la misma imagen es idempotente y una
  // imagen nueva invalida caches por cambio de URL.
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 8);
  const key = `blog/covers/${row.id}-${hash}.${ext}`;

  const previousKey = coverKeyFromUrl(row.coverImage);
  if (previousKey && previousKey !== key) {
    await deleteObject(previousKey); // best-effort: no lanza si no existe
  }

  const url = await uploadObject(key, buffer, file.type);

  await db.update(blogPosts).set({ coverImage: url, updatedAt: new Date() }).where(eq(blogPosts.id, row.id));

  await logBlogActivity({
    postId: row.id,
    type: 'editado',
    message: 'Portada subida',
    actorId: guard.uid,
    actorName: await getUserDisplayName(guard.uid),
  });

  return NextResponse.json({ ok: true, url });
}
