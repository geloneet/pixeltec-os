import { NextRequest, NextResponse } from 'next/server';
import { getSessionUid } from '@/lib/auth/session';
import { uploadBrandLogo } from '@/lib/growth/storage/brands';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function POST(req: NextRequest) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const brandId = (form.get('brandId') as string | null) ?? 'temp';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo mayor a 5MB' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadBrandLogo(uid, brandId, buffer, file.type);

  return NextResponse.json({ url });
}
