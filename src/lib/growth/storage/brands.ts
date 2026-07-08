import { deleteObject, uploadObject } from '@/lib/r2/upload';

// Extensiones posibles del logo — la ruta depende de la extensión, así que
// re-subir con un mimeType distinto (ej. png → svg) dejaba el archivo viejo
// huérfano hasta este fix (mismo patrón ya usado para avatares en
// src/lib/profile/actions.ts — deleteExistingAvatars).
const LOGO_EXTS = ['svg', 'png', 'jpg'] as const;

async function deleteExistingLogos(uid: string, brandId: string): Promise<void> {
  await Promise.allSettled(
    LOGO_EXTS.map((ext) => deleteObject(`growth/${uid}/brands/${brandId}/logo.${ext}`))
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

  await deleteExistingLogos(uid, brandId);

  return uploadObject(path, file, mimeType);
}
