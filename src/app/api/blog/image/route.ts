import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guards';
import { resolvePostRow } from '@/lib/blog/pg';
import { uploadObject } from '@/lib/r2/upload';

/**
 * Imágenes del CUERPO del artículo (WO-2026-00088, paridad Encino
 * `uploadBlogImageAction`) adaptadas al almacenamiento vigente: R2, con la
 * MISMA validación que la portada (`/api/blog/cover`): admin, MIME cerrado
 * sin SVG, ≤ 5 MB y magic bytes. Key con hash de contenido bajo
 * `blog/images/<postId>/`. No se persiste nada en BD: el editor inserta la
 * URL devuelta en el Markdown.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function magicBytesMatch(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (mime === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(undefined, { route: 'blog-cms:image-upload' });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const postId = (form.get('postId') as string | null) ?? '';
  if (!file || !postId) return NextResponse.json({ error: 'Faltan postId o file' }, { status: 400 });
  const ext = ALLOWED_EXT[file.type];
  if (!ext) return NextResponse.json({ error: 'Tipo de archivo no permitido (jpeg, png o webp)' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo mayor a 5MB' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!magicBytesMatch(buffer, file.type)) {
    return NextResponse.json({ error: 'El contenido del archivo no coincide con el tipo declarado' }, { status: 400 });
  }
  const row = await resolvePostRow(postId);
  if (!row) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });

  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const key = `blog/images/${row.id}/${hash}.${ext}`;
  const url = await uploadObject(key, buffer, file.type);
  return NextResponse.json({ ok: true, url });
}
