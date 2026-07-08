import { getStorage } from 'firebase-admin/storage';
import { getAdminApp } from '@/lib/firebase-admin';

// getAdminApp() se inicializa sin `storageBucket` (ver src/lib/firebase-admin.ts) —
// .bucket() sin argumento no tiene bucket por defecto y lanza
// "Bucket name not specified or invalid". Mismo bucket que usan los avatares
// (src/lib/profile/actions.ts) — bug real encontrado al verificar el fix de
// huérfanos de abajo: sin esto, uploadBrandLogo nunca llegaba a subir nada.
function getBrandLogoBucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var is required');
  return getStorage(getAdminApp()).bucket(name);
}

// Extensiones posibles del logo — la ruta depende de la extensión, así que
// re-subir con un mimeType distinto (ej. png → svg) dejaba el archivo viejo
// huérfano hasta este fix (mismo patrón ya usado para avatares en
// src/lib/profile/actions.ts — deleteExistingAvatars).
const LOGO_EXTS = ['svg', 'png', 'jpg'] as const;

async function deleteExistingLogos(
  bucket: ReturnType<ReturnType<typeof getStorage>['bucket']>,
  uid: string,
  brandId: string
): Promise<void> {
  await Promise.allSettled(
    LOGO_EXTS.map((ext) => bucket.file(`growth/${uid}/brands/${brandId}/logo.${ext}`).delete())
  );
}

export async function uploadBrandLogo(
  uid: string,
  brandId: string,
  file: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType === 'image/svg+xml' ? 'svg' : mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `growth/${uid}/brands/${brandId}/logo.${ext}`;

  const bucket = getBrandLogoBucket();

  await deleteExistingLogos(bucket, uid, brandId);

  const fileRef = bucket.file(path);

  await fileRef.save(file, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  await fileRef.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
