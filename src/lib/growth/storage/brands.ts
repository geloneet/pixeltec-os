import { getStorage } from 'firebase-admin/storage';
import { getAdminApp } from '@/lib/firebase-admin';

export async function uploadBrandLogo(
  uid: string,
  brandId: string,
  file: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType === 'image/svg+xml' ? 'svg' : mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `growth/${uid}/brands/${brandId}/logo.${ext}`;

  const bucket = getStorage(getAdminApp()).bucket();
  const fileRef = bucket.file(path);

  await fileRef.save(file, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  await fileRef.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
